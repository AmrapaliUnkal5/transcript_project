import requests
import os
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import SubscriptionPlan, Addon, UserSubscription
import json
from app.utils.logger import get_module_logger
import time

# Create a logger for this module
logger = get_module_logger(__name__)

class ZohoBillingService:
    def __init__(self, config: Dict[str, str] = None):
        """Initialize Zoho Billing Service with configuration"""
        self.config = config or {
            'client_id': os.getenv('ZOHO_CLIENT_ID'),
            'client_secret': os.getenv('ZOHO_CLIENT_SECRET'),
            'refresh_token': os.getenv('ZOHO_REFRESH_TOKEN'),
            'organization_id': os.getenv('ZOHO_ORGANIZATION_ID'),
        }
        self.access_token = os.getenv('ZOHO_ACCESS_TOKEN')
        self.token_expiry = datetime.now() + timedelta(hours=1) if self.access_token else datetime.now()  # Default expiry time
        self.base_url = "https://www.zohoapis.in/billing/v1"
        
        logger.info("=== ZohoBillingService Initialized ===")
        logger.info(f"Client ID: {self.config['client_id'][:5]}...{self.config['client_id'][-5:] if self.config['client_id'] else None}")
        logger.info(f"Client Secret: {self.config['client_secret'][:5]}...{self.config['client_secret'][-5:] if self.config['client_secret'] else None}")
        logger.info(f"Refresh Token: {self.config['refresh_token'][:5]}...{self.config['refresh_token'][-5:] if self.config['refresh_token'] else None}")
        logger.info(f"Organization ID: {self.config['organization_id']}")
        logger.info(f"Base URL: {self.base_url}")
        logger.info(f"Initial Access Token: {self.access_token[:5]}...{self.access_token[-5:] if self.access_token else None}")
        logger.info(f"Token Expiry: {self.token_expiry}")
        logger.info("=" * 40)
        
        # Always refresh the token at initialization to ensure we have a valid token
        if not self.access_token:
            try:
                self._refresh_access_token(force=True)
            except Exception as e:
                logger.warning(f"WARNING: Failed to get initial token: {str(e)}")

    def _refresh_access_token(self, force=False) -> None:
        """Refresh the Zoho API access token"""
        try:
            logger.info(f"\n=== Refreshing Zoho Access Token ===")
            logger.info(f"Force refresh: {force}")
            url = "https://accounts.zoho.in/oauth/v2/token"
            data = {
                'client_id': self.config['client_id'],
                'client_secret': self.config['client_secret'],
                'refresh_token': self.config['refresh_token'],
                'grant_type': 'refresh_token',
                'scope': 'ZohoSubscriptions.hostedpages.CREATE ZohoSubscriptions.subscriptions.ALL ZohoSubscriptions.plans.ALL ZohoSubscriptions.addons.ALL'
            }
            logger.debug(f"Token refresh URL: {url}")
            logger.debug(f"Token refresh data: {data}")
            
            response = requests.post(url, data=data)
            
            logger.debug(f"Token refresh status code: {response.status_code}")
            logger.debug(f"Token refresh response: {response.text}")
            
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data['access_token']
            self.token_expiry = datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))
            
            # Update the environment variable (for debugging/development purposes)
            os.environ['ZOHO_ACCESS_TOKEN'] = self.access_token
            
            logger.info(f"New access token: {self.access_token[:5]}...{self.access_token[-5:]}")
            logger.info(f"Token expires at: {self.token_expiry}")
            logger.info("=" * 40)
            
            logger.info("Zoho access token refreshed successfully")
        except Exception as e:
            logger.error(f"ERROR refreshing token: {str(e)}")
            raise

    def _get_headers(self, force_refresh=False) -> Dict[str, str]:
        """Get request headers with valid access token"""
        logger.info(f"\n=== Getting Zoho API Headers ===")
        logger.info(f"Current time: {datetime.now()}")
        logger.info(f"Token expiry: {self.token_expiry}")
        logger.info(f"Token expired: {datetime.now() >= self.token_expiry}")
        logger.info(f"Force refresh: {force_refresh}")
        
        if not self.access_token or datetime.now() >= self.token_expiry or force_refresh:
            logger.info("Access token missing or expired, refreshing...")
            self._refresh_access_token(force=force_refresh)
        else:
            logger.info(f"Using existing token: {self.access_token[:5]}...{self.access_token[-5:]}")
            
        headers = {
            'Authorization': f'Zoho-oauthtoken {self.access_token}',
            'X-com-zoho-subscriptions-organizationid': self.config['organization_id'],
            'Content-Type': 'application/json'
        }
        
        logger.info(f"Headers generated: {headers}")
        logger.info("=" * 40)
        return headers

    def get_all_plans(self) -> List[Dict[str, Any]]:
        """Get all plans from Zoho Billing"""
        try:
            url = f"{self.base_url}/plans"
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            
            return response.json().get('plans', [])
        except Exception as e:
            logger.error(f"ERROR fetching plans from Zoho: {str(e)}")
            return []

    def get_plan_by_code(self, plan_code: str) -> Optional[Dict[str, Any]]:
        """Get a specific plan by its code"""
        try:
            url = f"{self.base_url}/plans"
            headers = self._get_headers()
            response = requests.get(url, headers=headers)
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error in get_plan_by_code. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                response = requests.get(url, headers=headers)
            
            response.raise_for_status()
            
            plans = response.json().get('plans', [])
            for plan in plans:
                if plan.get('plan_code') == plan_code:
                    return plan
            return None
        except Exception as e:
            logger.error(f"ERROR fetching plan {plan_code} from Zoho: {str(e)}")
            return None

    def create_plan(self, plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new plan in Zoho Billing"""
        try:
            logger.info(f"Creating plan with data: {plan_data}")
            url = f"{self.base_url}/plans"
            headers = self._get_headers()
            response = requests.post(url, headers=headers, json=plan_data)
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error in create_plan. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                response = requests.post(url, headers=headers, json=plan_data)
            
            response.raise_for_status()
            
            response_data = response.json()
            logger.info(f"Plan creation response: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('plan'):
                return response_data.get('plan', {})
            else:
                error_msg = response_data.get('message', 'Unknown error from Zoho API')
                logger.error(f"Zoho API error: {error_msg}")
                raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error creating plan in Zoho: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"ERROR creating plan in Zoho: {str(e)}")
            raise

    def update_plan(self, plan_id: str, plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing plan in Zoho Billing"""
        try:
            logger.info(f"Updating plan {plan_id} with data: {plan_data}")
            url = f"{self.base_url}/plans/{plan_id}"
            response = requests.put(url, headers=self._get_headers(), json=plan_data)
            response.raise_for_status()
            
            response_data = response.json()
            logger.info(f"Plan update response: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('plan'):
                return response_data.get('plan', {})
            else:
                error_msg = response_data.get('message', 'Unknown error from Zoho API')
                logger.error(f"Zoho API error: {error_msg}")
                raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error updating plan in Zoho: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"ERROR updating plan in Zoho: {str(e)}")
            raise

    def get_all_addons(self) -> List[Dict[str, Any]]:
        """Get all addons from Zoho Billing"""
        try:
            url = f"{self.base_url}/addons"
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            
            return response.json().get('addons', [])
        except Exception as e:
            logger.error(f"ERROR fetching addons from Zoho: {str(e)}")
            return []

    def get_addon_by_code(self, addon_code: str) -> Optional[Dict[str, Any]]:
        """Get a specific addon by its code"""
        try:
            url = f"{self.base_url}/addons"
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            
            addons = response.json().get('addons', [])
            for addon in addons:
                if addon.get('addon_code') == addon_code:
                    return addon
            return None
        except Exception as e:
            logger.error(f"ERROR fetching addon {addon_code} from Zoho: {str(e)}")
            return None

    def create_addon(self, addon_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new addon in Zoho Billing as per API documentation"""
        try:
            url = f"{self.base_url}/addons"
            headers = self._get_headers()

            # Construct payload as per Zoho Billing API docs
            # Reference: https://www.zoho.com/billing/api/v1/addons/#create-an-addon
            payload = {
                "name": addon_data["name"],                           # Required
                "addon_code": addon_data["addon_code"],               # Required
                "unit_name": addon_data.get("unit_name", "Unit"),     # Required
                "price_brackets": addon_data["price_brackets"],       # Required
                "description": addon_data.get("description", f"Addon for {addon_data['name']}"),  # Optional
                "product_id": addon_data.get("product_id"),           # Required
                "applicable_to_all_plans": addon_data.get("applicable_to_all_plans", True),  # Optional
            }

            # Log the exact payload to be sent
            logger.debug(f"Creating addon with payload: {json.dumps(payload, indent=2)}")
            
            # Make the API request
            response = requests.post(url, headers=headers, json=payload)
            
            # Log the response
            logger.debug(f"Zoho create addon response status: {response.status_code}")
            
            try:
                response_json = response.json()
                logger.debug(f"Zoho create addon response: {json.dumps(response_json, indent=2)}")
            except:
                logger.debug(f"Raw response: {response.text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            logger.info(f"Addon created successfully: {response_data}")

            if response_data.get('code') == 0 and response_data.get('addon'):
                return response_data.get('addon', {})
            else:
                error_msg = response_data.get('message', 'Unknown error from Zoho API')
                logger.error(f"Zoho API error while creating addon: {error_msg}")
                raise Exception(error_msg)

        except requests.exceptions.RequestException as e:
            logger.error(f"Request error creating addon in Zoho: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"ERROR creating addon in Zoho: {str(e)}")
            raise

    def update_addon(self, addon_id: str, addon_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing addon in Zoho Billing"""
        try:
            url = f"{self.base_url}/addons/{addon_id}"
            response = requests.put(url, headers=self._get_headers(), json=addon_data)
            response.raise_for_status()
            
            return response.json().get('addon', {})
        except Exception as e:
            logger.error(f"ERROR updating addon in Zoho: {str(e)}")
            raise

    def get_hosted_page_url(self, subscription_data: Dict[str, Any]) -> str:
        """Get a hosted page URL for subscription checkout"""
        try:
            logger.info(f"\n=== Creating Zoho Hosted Page ===")
            logger.info(f"Input subscription data: {subscription_data}")
            
            # Check if addons exist in the payload
            has_addons = "addons" in subscription_data and subscription_data["addons"]
            logger.info(f"Payload contains addons: {has_addons}")
            if has_addons:
                logger.info(f"Number of addons in payload: {len(subscription_data['addons'])}")
                for i, addon in enumerate(subscription_data["addons"]):
                    logger.info(f"  Addon {i+1}: {addon}")
            
            logger.info(f"Creating hosted page with data: {subscription_data}")
            url = f"{self.base_url}/hostedpages/newsubscription"
            logger.info(f"API URL: {url}")
            
            # Get headers with token
            headers = self._get_headers()
            logger.info(f"Using headers: {headers}")
            
            # Make the API request
            logger.info("Sending request to Zoho API...")
            
            # Convert to JSON string for logging exact payload sent
            payload_json = json.dumps(subscription_data)
            logger.debug(f"Exact JSON payload being sent:\n{payload_json}")
            
            response = requests.post(url, headers=headers, json=subscription_data)
            
            # Log the full response
            logger.debug(f"Zoho API response status: {response.status_code}")
            logger.debug(f"Zoho API response headers: {dict(response.headers)}")
            
            response_text = response.text
            logger.debug(f"Zoho API raw response: {response_text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error. Refreshing token and retrying...")
                # Force refresh the token
                headers = self._get_headers(force_refresh=True)
                logger.info("Retrying request with new token...")
                response = requests.post(url, headers=headers, json=subscription_data)
                logger.debug(f"Retry response status: {response.status_code}")
                logger.debug(f"Retry response: {response.text}")
            
            try:
                response_json = response.json()
                logger.debug(f"Zoho API JSON response: {response_json}")
                logger.info(f"Zoho API response body: {response_json}")
                
                # Deeply inspect the response for addon-related information
                if "hostedpage" in response_json:
                    hostedpage = response_json["hostedpage"]
                    if "page_context" in hostedpage:
                        page_context = hostedpage["page_context"]
                        logger.info(f"Page context from response: {page_context}")
                        
                        if "subscription" in page_context:
                            sub_context = page_context["subscription"]
                            logger.info(f"Subscription context: {sub_context}")
                            
                            if "addons" in sub_context:
                                logger.info(f"Addons in response context: {sub_context['addons']}")
                            else:
                                logger.info("WARNING: No addons found in subscription context")
            except Exception as e:
                logger.info(f"Error parsing or inspecting JSON response: {str(e)}")
                logger.info(f"Zoho API response text: {response_text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            logger.info(f"Processing response data: {response_data}")
            logger.info(f"Hosted page response: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('hostedpage'):
                hosted_page_data = response_data.get('hostedpage', {})
                hosted_page_url = hosted_page_data.get('url', '')
                
                logger.info(f"Checkout URL generated: {hosted_page_url}")
                
                if not hosted_page_url:
                    logger.error("ERROR: No URL returned in the hosted page response")
                    raise Exception("No URL returned in the hosted page response")
                    
                logger.info("=" * 40)
                return hosted_page_url
            else:
                error_msg = response_data.get('message', 'Unknown error from Zoho API')
                logger.error(f"ERROR: Zoho API error: {error_msg}")
                raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            logger.error(f"ERROR: Request exception: {str(e)}")
            logger.error(f"Request error creating hosted page: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"ERROR: Exception creating hosted page: {str(e)}")
            logger.error(f"Error creating hosted page for subscription: {str(e)}")
            raise

    def get_recurring_addon_hosted_page_url(self, subscription_id: str, addon_code: str, quantity: int = 1) -> str:
        """
        Get a hosted page URL for adding a recurring addon to an existing subscription
        
        Args:
            subscription_id: Zoho subscription ID to add the addon to
            addon_code: Addon code to add
            quantity: Quantity of the addon
            
        Returns:
            URL for the hosted page
        """
        try:
            print(f"\n=== Creating Zoho Hosted Page for Recurring Add-on Purchase ===")
            print(f"Subscription ID: {subscription_id}")
            print(f"Add-on code: {addon_code}")
            print(f"Quantity: {quantity}")
            
            # For recurring addons, we use the updatesubscription hosted page
            # This allows adding addons that will renew with the subscription
            # Note: updatesubscription endpoint doesn't need customer data since it's modifying existing subscription
            payload = {
                "subscription_id": subscription_id,
                "addons": [
                    {
                        "addon_code": addon_code,
                        "quantity": quantity
                    }
                ],
                "redirect_url": f"{self.get_frontend_url()}/account/add-ons",
                "cancel_url": f"{self.get_frontend_url()}/account/add-ons"
            }
                
            logger.info(f"Creating recurring add-on hosted page with data: {payload}")
            url = f"{self.base_url}/hostedpages/updatesubscription"
            print(f"API URL: {url}")
            
            # Get headers with token
            headers = self._get_headers()
            
            # Convert to JSON string for logging exact payload sent
            payload_json = json.dumps(payload)
            print(f"Exact JSON payload being sent:\n{payload_json}")
            
            # Make the API request
            response = requests.post(url, headers=headers, json=payload)
            
            # Log the full response
            print(f"Zoho API response status: {response.status_code}")
            print(f"Zoho API response headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Zoho API raw response: {response_text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                print("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                print("Retrying request with new token...")
                response = requests.post(url, headers=headers, json=payload)
                print(f"Retry response status: {response.status_code}")
                print(f"Retry response: {response.text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            print(f"Processing response data: {response_data}")
            logger.info(f"Recurring addon hosted page response: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('hostedpage'):
                hosted_page_data = response_data.get('hostedpage', {})
                hosted_page_url = hosted_page_data.get('url', '')
                
                if hosted_page_url:
                    print(f"Successfully created recurring addon hosted page: {hosted_page_url}")
                    logger.info(f"Recurring addon hosted page URL: {hosted_page_url}")
                    return hosted_page_url
                else:
                    print("No URL found in hosted page response")
                    logger.error("No URL found in hosted page response")
            else:
                print(f"Error in response: {response_data}")
                logger.error(f"Error in recurring addon hosted page response: {response_data}")
            
            return None
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error creating recurring addon hosted page: {str(e)}")
            print(f"Request error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error creating recurring addon hosted page: {str(e)}")
            print(f"General error: {str(e)}")
            raise

    def sync_plans_with_zoho(self, db: Session) -> Dict[str, Any]:
        result = {
            "created": 0,
            "updated": 0,
            "synced": 0,
            "errors": []
        }

        try:
            # Retrieve all local subscription plans
            local_plans = db.query(SubscriptionPlan).all()
            logger.info(f"Found {len(local_plans)} plans to sync with Zoho")

            for plan in local_plans:
                # Construct the plan data payload as per Zoho Billing API
                plan_data = {
                    "plan_code": plan.zoho_plan_code or f"PLAN_{plan.id}",
                    "name": plan.name,
                    "recurring_price": float(plan.price) if plan.price is not None else 0,
                    "interval": 1,
                    "product_id": plan.zoho_product_id,
                }

                # Check if the plan already exists in Zoho
                if plan.zoho_plan_code:
                    zoho_plan = self.get_plan_by_code(plan.zoho_plan_code)

                    if zoho_plan:
                        # Compare and update if necessary
                        existing_price = zoho_plan.get('recurring_price', 0)
                        if float(plan.price or 0) != float(existing_price):
                            zoho_plan_id = zoho_plan.get('plan_id')
                            updated_plan = self.update_plan(zoho_plan_id, {
                                "recurring_price": float(plan.price) if plan.price is not None else 0
                            })
                            plan.zoho_plan_id = updated_plan.get('plan_id')
                            result["updated"] += 1
                        else:
                            plan.zoho_plan_id = zoho_plan.get('plan_id')
                            result["synced"] += 1
                    else:
                        # Plan code exists locally but not in Zoho; create it
                        created_plan = self.create_plan(plan_data)
                        plan.zoho_plan_id = created_plan.get('plan_id')
                        plan.zoho_plan_code = created_plan.get('plan_code')
                        result["created"] += 1
                elif plan.zoho_product_id is not None:
                    # Plan does not exist in Zoho; create it
                    created_plan = self.create_plan(plan_data)
                    plan.zoho_plan_id = created_plan.get('plan_id')
                    plan.zoho_plan_code = created_plan.get('plan_code')
                    result["created"] += 1

            db.commit()
            logger.info(f"Plan sync completed: {result}")

        except Exception as e:
            db.rollback()
            error_msg = f"Error syncing plans with Zoho: {str(e)}"
            logger.error(error_msg)
            result["errors"].append(error_msg)

        return result

    def sync_addons_with_zoho(self, db: Session) -> Dict[str, Any]:
        """Sync all local addons with Zoho API"""
        result = {
            "created": 0,
            "updated": 0,
            "synced": 0,
            "errors": []
        }

        try:
            # Retrieve all local addons
            local_addons = db.query(Addon).all()
            print(f"\n==== Starting Addon Sync - Found {len(local_addons)} addons ====")

            for addon in local_addons:
                try:
                    print(f"Processing addon: {addon.id} - {addon.name}")
                    # Verify required fields
                    if not addon.zoho_product_id:
                        addon.zoho_product_id = os.getenv('ZOHO_DEFAULT_PRODUCT_ID', '2482582000000054001')
                        print(f"  - Set default product_id: {addon.zoho_product_id}")
                    
                    if not addon.addon_type:
                        addon.addon_type = "one_time"
                        print(f"  - Set default addon_type: {addon.addon_type}")
                    
                    # Always ensure the addon has a code
                    if not addon.zoho_addon_code:
                        addon.zoho_addon_code = f"ADDON_{addon.id}_{int(addon.price * 100)}"
                        print(f"  - Generated new addon_code: {addon.zoho_addon_code}")
                    
                    # Construct the addon data payload as per Zoho Billing API
                    addon_data = {
                        "addon_code": addon.zoho_addon_code,
                        "name": addon.name,
                        "pricing_scheme": "flat",
                        "price_brackets": [
                            {
                                "start_quantity": 1,
                                "end_quantity": 1,
                                "price": float(addon.price)  # Important: Send as float, not int
                            }
                        ],
                        "type": getattr(addon, 'addon_type', "one_time") or "one_time",
                        "product_id": addon.zoho_product_id,
                        "description": getattr(addon, 'description', f"Addon: {addon.name}") or f"Addon: {addon.name}",
                        "applicable_to_all_plans": True,
                        "status": "active",
                        "unit_name": "Unit"  # Default unit name
                    }
                    
                    print(f"  - Addon data prepared: {json.dumps(addon_data, indent=2)}")

                    # Check if the addon already exists in Zoho
                    if addon.zoho_addon_code:
                        zoho_addon = self.get_addon_by_code(addon.zoho_addon_code)
                        print(f"  - Zoho lookup result: {'Found' if zoho_addon else 'Not found'}")

                        if zoho_addon:
                            # Compare and update if necessary
                            existing_price = zoho_addon.get('price_brackets', [{}])[0].get('price', 0)
                            if float(addon.price or 0) != float(existing_price):
                                print(f"  - Price difference: {addon.price} vs {existing_price}, updating")
                                zoho_addon_id = zoho_addon.get('addon_id')
                                updated_addon = self.update_addon(zoho_addon_id, {
                                    "price_brackets": [
                                        {
                                            "start_quantity": 1,
                                            "end_quantity": 1,
                                            "price": float(addon.price)
                                        }
                                    ]
                                })
                                addon.zoho_addon_id = updated_addon.get('addon_id')
                                result["updated"] += 1
                                print(f"  - Updated addon in Zoho with ID: {addon.zoho_addon_id}")
                            else:
                                addon.zoho_addon_id = zoho_addon.get('addon_id')
                                result["synced"] += 1
                                print(f"  - Addon already in sync with Zoho ID: {addon.zoho_addon_id}")
                        else:
                            # Addon code exists locally but not in Zoho; create it
                            print(f"  - Creating new addon in Zoho")
                            created_addon = self.create_addon(addon_data)
                            addon.zoho_addon_id = created_addon.get('addon_id')
                            addon.zoho_addon_code = created_addon.get('addon_code')
                            result["created"] += 1
                            print(f"  - Created addon in Zoho with ID: {addon.zoho_addon_id}")
                    else:
                        # Addon does not exist in Zoho; create it
                        print(f"  - No addon code, creating new addon in Zoho")
                        created_addon = self.create_addon(addon_data)
                        addon.zoho_addon_id = created_addon.get('addon_id')
                        addon.zoho_addon_code = created_addon.get('addon_code')
                        result["created"] += 1
                        print(f"  - Created addon in Zoho with ID: {addon.zoho_addon_id}")
                except Exception as e:
                    error_msg = f"Error syncing addon {addon.id} - {addon.name}: {str(e)}"
                    print(f"ERROR: {error_msg}")
                    logger.error(error_msg)
                    result["errors"].append(error_msg)

            db.commit()
            print(f"==== Addon Sync Complete ====")
            print(f"Created: {result['created']}, Updated: {result['updated']}, Synced: {result['synced']}")
            print(f"Errors: {len(result['errors'])}")
            if result['errors']:
                print("First few errors:")
                for error in result['errors'][:3]:
                    print(f"  - {error}")
            print("============================\n")

        except Exception as e:
            db.rollback()
            logger.error(f"Error syncing addons with Zoho: {str(e)}")
            result["errors"].append(str(e))

        return result

    def get_frontend_url(self) -> str:
        """Get the frontend URL from environment variables with a fallback default"""
        return os.getenv('FRONTEND_URL', 'https://evolra.ai')

    def get_addon_hosted_page_url(self, subscription_id: str, addon_data: Dict[str, Any]) -> str:
        """
        Get a hosted page URL for buying a one-time addon for an existing subscription
        
        Args:
            subscription_id: Zoho subscription ID to add the addon to
            addon_data: Dictionary containing addon details
            
        Returns:
            URL for the hosted page
        """
        try:
            print(f"\n=== Creating Zoho Hosted Page for Add-on Purchase ===")
            print(f"Subscription ID: {subscription_id}")
            print(f"Add-on data: {addon_data}")
            
            # Prepare the payload according to Zoho API docs
            payload = {
                "subscription_id": subscription_id,
                "addons": addon_data["addons"],
                "redirect_url": addon_data.get("redirect_url"),
                "cancel_url": addon_data.get("cancel_url")
            }
            
            # Add customer if provided
            if "customer" in addon_data:
                payload["customer"] = addon_data["customer"]
                
            logger.info(f"Creating add-on hosted page with data: {payload}")
            url = f"{self.base_url}/hostedpages/buyonetimeaddon"
            print(f"API URL: {url}")
            
            # Get headers with token
            headers = self._get_headers()
            
            # Convert to JSON string for logging exact payload sent
            payload_json = json.dumps(payload)
            print(f"Exact JSON payload being sent:\n{payload_json}")
            
            # Make the API request
            response = requests.post(url, headers=headers, json=payload)
            
            # Log the full response
            print(f"Zoho API response status: {response.status_code}")
            print(f"Zoho API response headers: {dict(response.headers)}")
            
            response_text = response.text
            print(f"Zoho API raw response: {response_text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                print("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                print("Retrying request with new token...")
                response = requests.post(url, headers=headers, json=payload)
                print(f"Retry response status: {response.status_code}")
                print(f"Retry response: {response.text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            print(f"Processing response data: {response_data}")
            logger.info(f"Hosted page response: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('hostedpage'):
                hosted_page_data = response_data.get('hostedpage', {})
                hosted_page_url = hosted_page_data.get('url', '')
                
                print(f"Checkout URL generated: {hosted_page_url}")
                
                if not hosted_page_url:
                    print("ERROR: No URL returned in the hosted page response")
                    raise Exception("No URL returned in the hosted page response")
                    
                print("=" * 40)
                return hosted_page_url
            else:
                error_msg = response_data.get('message', 'Unknown error from Zoho API')
                print(f"ERROR: Zoho API error: {error_msg}")
                logger.error(f"Zoho API error: {error_msg}")
                raise Exception(error_msg)
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Request exception: {str(e)}")
            logger.error(f"Request error creating add-on hosted page: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    print(f"Zoho API error details: {error_data}")
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    print(f"Raw error response: {e.response.text}")
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            print(f"ERROR: Exception creating add-on hosted page: {str(e)}")
            logger.error(f"Error creating add-on hosted page: {str(e)}")
            raise


# Helper functions
def format_subscription_data_for_hosted_page(
    user_id: int, 
    user_data: Dict[str, Any], 
    plan_code: str,
    addon_codes: List[str] = None
) -> Dict[str, Any]:
    """Correct payload for Zoho Hosted Page subscription checkout"""
    
    # Get the frontend URL from environment variables or use default
    frontend_url = os.getenv('FRONTEND_URL', 'https://evolra.ai')
    
    # Enhanced debugging logs
    print(f"\n==== DEBUG: Creating Zoho Checkout Payload ====")
    print(f"User ID: {user_id}")
    print(f"User Data: {user_data}")
    print(f"Plan Code: {plan_code}")
    print(f"Addon Codes (received): {addon_codes}")
    
    if not addon_codes:
        print("WARNING: No addon codes were provided")
    elif len(addon_codes) == 0:
        print("WARNING: Empty addon_codes list was provided")
    
    # Create the basic subscription data structure according to Zoho API docs
    subscription_data = {
        "customer": {
            "display_name": user_data.get("name", ""),
            "email": user_data.get("email", "")
        },
        "plan": {
            "plan_code": plan_code,
            "quantity": 1  # Required by Zoho Billing
        },
        "redirect_url": f"{frontend_url}/",  # Redirect to dashboard after successful payment
        "cancel_url": f"{frontend_url}/subscription"  # Redirect back to subscription page if cancelled
    }
    
    # Add phone number/mobile - using mobile instead of phone for Zoho
    # Use default number if not present
    subscription_data["customer"]["mobile"] = user_data.get("phone_no") or "9081726354"
    
    if user_data.get("company_name"):
        subscription_data["customer"]["company_name"] = user_data.get("company_name")
    
    # Add addons if provided
    if addon_codes and len(addon_codes) > 0:
        print(f"Adding addons to the checkout payload")
        
        # Count occurrences of each addon code to handle multiple selections of the same addon
        addon_counts = {}
        for code in addon_codes:
            addon_counts[code] = addon_counts.get(code, 0) + 1
        
        # Create the addons array with correct quantities
        subscription_data["addons"] = [
            {"addon_code": code, "quantity": count} 
            for code, count in addon_counts.items()
        ]
        
        # Log each addon being added with its quantity
        for i, (code, count) in enumerate(addon_counts.items()):
            print(f"Addon {i+1}: addon_code={code}, quantity={count}")
    else:
        print("No addons added to checkout payload")
    
    # Print the final payload for debugging
    print(f"Final subscription payload: {json.dumps(subscription_data, indent=2)}")
    print("==== END Checkout Payload ====\n")
    
    return subscription_data