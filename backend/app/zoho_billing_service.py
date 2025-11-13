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
from app.config import settings

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
                print("Hosted Page URL New =>",hosted_page_url)
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
    
    def get_recurring_addon_hosted_page_url(self, subscription_id: str, addon_code: str, quantity: int = 1, mode: str = "subscription_update") -> str:
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
            # If this call represents a standalone recurring addon purchase (not a plan update),
            # we should treat the requested quantity as an increment over existing quantity to avoid
            # triggering a perceived downgrade when users later buy fewer units.
            effective_quantity = quantity
            if (mode or "").lower() == "addon_purchase":
                try:
                    current_details = self.get_subscription_details(subscription_id)
                    current_quantity = 0
                    subscription_obj = (current_details or {}).get("subscription") or {}
                    for item in subscription_obj.get("addons", []) or []:
                        if item.get("addon_code") == addon_code:
                            # Zoho returns quantity per add-on instance
                            current_quantity = int(item.get("quantity", 0) or 0)
                            break
                    # Additive quantity so Zoho charges only the delta at checkout
                    effective_quantity = max(1, int(current_quantity) + int(quantity))
                except Exception as _e:
                    # Fallback to requested quantity if anything fails
                    effective_quantity = quantity

            # Build addons list preserving existing recurring addons to avoid Zoho issuing credits
            existing_addons: List[Dict[str, Any]] = []
            try:
                current_details = self.get_subscription_details(subscription_id)
                subscription_obj = (current_details or {}).get("subscription") or {}
                for item in subscription_obj.get("addons", []) or []:
                    code = item.get("addon_code")
                    qty = int(item.get("quantity", 0) or 0)
                    if code and qty > 0:
                        existing_addons.append({"addon_code": code, "quantity": qty})
            except Exception as _e:
                # If fetching fails, proceed with minimal payload; Zoho may replace list, but we already handled effective quantity
                existing_addons = []

            # Merge or add the requested addon
            updated = False
            for entry in existing_addons:
                if entry.get("addon_code") == addon_code:
                    entry["quantity"] = int(effective_quantity)
                    updated = True
                    break
            if not updated:
                existing_addons.append({
                    "addon_code": addon_code,
                    "quantity": int(effective_quantity)
                })

            payload = {
                "subscription_id": subscription_id,
                "addons": existing_addons if existing_addons else [
                    {"addon_code": addon_code, "quantity": int(effective_quantity)}
                ],
                "redirect_url": f"{self.get_frontend_url()}/dashboard/welcome?addonpayment=success",
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
        
    def get_subscription_update_hosted_page_url(self, subscription_id: str, update_data: Dict[str, Any]) -> str:
        """
        Get a hosted page URL for updating an existing subscription
        
        Args:
            subscription_id: Zoho subscription ID to update
            update_data: Dictionary containing update details
            
        Returns:
            URL for the hosted page
        """
        try:
            logger.info(f"\n=== Creating Zoho Subscription Update Hosted Page ===")
            logger.info(f"Subscription ID: {subscription_id}")
            logger.info(f"Update data: {update_data}")
            
            url = f"{self.base_url}/hostedpages/updatesubscription"
            logger.info(f"API URL: {url}")
            
            # Prepare the payload for subscription update
            payload = {
                "subscription_id": subscription_id,
                **update_data
            }
            
            # Get headers with token
            headers = self._get_headers()
            logger.info(f"Using headers: {headers}")
            
            # Convert to JSON string for logging exact payload sent
            payload_json = json.dumps(payload)
            logger.debug(f"Exact JSON payload being sent:\n{payload_json}")
            
            # Make the API request
            response = requests.post(url, headers=headers, json=payload)
            
            # Log the full response
            logger.debug(f"Zoho API response status: {response.status_code}")
            logger.debug(f"Zoho API response headers: {dict(response.headers)}")
            
            response_text = response.text
            logger.debug(f"Zoho API raw response: {response_text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                logger.info("Retrying request with new token...")
                response = requests.post(url, headers=headers, json=payload)
                logger.debug(f"Retry response status: {response.status_code}")
                logger.debug(f"Retry response: {response.text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            logger.info(f"Processing response data: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('hostedpage'):
                hosted_page_data = response_data.get('hostedpage', {})
                hosted_page_url = hosted_page_data.get('url', '')
                
                logger.info(f"Update checkout URL generated: {hosted_page_url}")
                
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
            logger.error(f"ERROR: Request exception creating update hosted page: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"ERROR: Exception creating update hosted page: {str(e)}")
            raise

    def update_subscription_addons_api(self, subscription_id: str, addons: List[Dict[str, Any]], apply_on_renewal: bool = True) -> Dict[str, Any]:
        """Direct API to update subscription addons without hosted page.
        If apply_on_renewal is True, changes take effect at next billing (no immediate charge).
        """
        try:
            url = f"{self.base_url}/subscriptions/{subscription_id}"
            headers = self._get_headers()
            payload: Dict[str, Any] = {
                "addons": addons,
                # Schedule changes at end of current term to avoid immediate charges
                "end_of_term": bool(apply_on_renewal),
                "prorate": False
            }
            try:
                logger.info("Preparing Zoho update subscription API call")
                logger.info(f"Subscription ID: {subscription_id}")
                logger.info(f"Endpoint URL: {url}")
                logger.info(f"Request payload: {json.dumps(payload)}")
            except Exception as _log_e:
                logger.warning(f"Could not serialize payload for logging: {str(_log_e)}")
            response = requests.put(url, headers=headers, json=payload)
            if response.status_code == 401:
                headers = self._get_headers(force_refresh=True)
                response = requests.put(url, headers=headers, json=payload)
            if not response.ok:
                logger.error(f"Zoho update subscription (API) error body: {response.text}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error updating subscription addons via API for {subscription_id}: {str(e)}")
            raise

    def cancel_subscription(self, subscription_id: str, cancel_at_term_end: bool = True, reason: Optional[str] = None) -> Dict[str, Any]:
        """Cancel a subscription in Zoho.
        If cancel_at_term_end=True, use non-renewing (end-of-term) behavior per Zoho (cancel_at_end=true).
        """
        try:
            url = f"{self.base_url}/subscriptions/{subscription_id}/cancel"
            headers = self._get_headers()
            # Zoho expects cancel_at_end in query to mark non_renewing; false cancels immediately
            params = {"cancel_at_end": str(bool(cancel_at_term_end)).lower()}
            # Some orgs accept comment in body
            payload: Dict[str, Any] = {"comment": reason} if reason else {}

            response = requests.post(url, headers=headers, params=params, json=(payload or None))
            if response.status_code == 401:
                headers = self._get_headers(force_refresh=True)
                response = requests.post(url, headers=headers, params=params, json=(payload or None))

            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error cancelling subscription {subscription_id}: {str(e)}")
            raise

    def get_customer_details(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch customer details from Zoho including billing address and account information
        
        Args:
            customer_id: Zoho customer ID
            
        Returns:
            Dictionary containing customer details or None if not found
        """
        try:
            logger.info(f"\n=== Fetching Customer Details from Zoho ===")
            logger.info(f"Customer ID: {customer_id}")
            
            url = f"{self.base_url}/customers/{customer_id}"
            logger.info(f"API URL: {url}")
            
            # Get headers with token
            headers = self._get_headers()
            
            # Make the API request
            response = requests.get(url, headers=headers)
            
            logger.debug(f"Zoho customer API response status: {response.status_code}")
            logger.debug(f"Zoho customer API response: {response.text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                response = requests.get(url, headers=headers)
                logger.debug(f"Retry response status: {response.status_code}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            
            if response_data.get('code') == 0 and response_data.get('customer'):
                customer_data = response_data.get('customer', {})
                logger.info(f"Successfully fetched customer details for ID: {customer_id}")
                logger.debug(f"Customer data: {customer_data}")
                return customer_data
            else:
                error_msg = response_data.get('message', 'Customer not found')
                logger.warning(f"Could not fetch customer details: {error_msg}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"ERROR: Request exception fetching customer details: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"ERROR: Exception fetching customer details: {str(e)}")
            return None

    def get_subscription_update_hosted_page_url(self, subscription_id: str, update_data: Dict[str, Any]) -> str:
        """
        Get a hosted page URL for updating an existing subscription
        
        Args:
            subscription_id: Zoho subscription ID to update
            update_data: Dictionary containing update details
            
        Returns:
            URL for the hosted page
        """
        try:
            logger.info(f"\n=== Creating Zoho Subscription Update Hosted Page ===")
            logger.info(f"Subscription ID: {subscription_id}")
            logger.info(f"Update data: {update_data}")
            
            url = f"{self.base_url}/hostedpages/updatesubscription"
            logger.info(f"API URL: {url}")
            
            # Prepare the payload for subscription update
            payload = {
                "subscription_id": subscription_id,
                **update_data
            }
            
            # Get headers with token
            headers = self._get_headers()
            logger.info(f"Using headers: {headers}")
            
            # Convert to JSON string for logging exact payload sent
            payload_json = json.dumps(payload)
            logger.debug(f"Exact JSON payload being sent:\n{payload_json}")
            
            # Make the API request
            response = requests.post(url, headers=headers, json=payload)
            
            # Log the full response
            logger.debug(f"Zoho API response status: {response.status_code}")
            logger.debug(f"Zoho API response headers: {dict(response.headers)}")
            
            response_text = response.text
            logger.debug(f"Zoho API raw response: {response_text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                logger.info("Retrying request with new token...")
                response = requests.post(url, headers=headers, json=payload)
                logger.debug(f"Retry response status: {response.status_code}")
                logger.debug(f"Retry response: {response.text}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            logger.info(f"Processing response data: {response_data}")
            
            if response_data.get('code') == 0 and response_data.get('hostedpage'):
                hosted_page_data = response_data.get('hostedpage', {})
                hosted_page_url = hosted_page_data.get('url', '')
                print("Update checkout url update=>",hosted_page_url)
                logger.info(f"Update checkout URL generated: {hosted_page_url}")
                
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
            logger.error(f"ERROR: Request exception creating update hosted page: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"ERROR: Exception creating update hosted page: {str(e)}")
            raise

    def get_customer_details(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch customer details from Zoho including billing address and account information
        
        Args:
            customer_id: Zoho customer ID
            
        Returns:
            Dictionary containing customer details or None if not found
        """
        try:
            logger.info(f"\n=== Fetching Customer Details from Zoho ===")
            logger.info(f"Customer ID: {customer_id}")
            
            url = f"{self.base_url}/customers/{customer_id}"
            logger.info(f"API URL: {url}")
            
            # Get headers with token
            headers = self._get_headers()
            
            # Make the API request
            response = requests.get(url, headers=headers)
            
            logger.debug(f"Zoho customer API response status: {response.status_code}")
            logger.debug(f"Zoho customer API response: {response.text}")
            
            # If we get a 401 error, refresh token and try again
            if response.status_code == 401:
                logger.info("Received 401 Unauthorized error. Refreshing token and retrying...")
                headers = self._get_headers(force_refresh=True)
                response = requests.get(url, headers=headers)
                logger.debug(f"Retry response status: {response.status_code}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse the response
            response_data = response.json()
            
            if response_data.get('code') == 0 and response_data.get('customer'):
                customer_data = response_data.get('customer', {})
                logger.info(f"Successfully fetched customer details for ID: {customer_id}")
                logger.debug(f"Customer data: {customer_data}")
                return customer_data
            else:
                error_msg = response_data.get('message', 'Customer not found')
                logger.warning(f"Could not fetch customer details: {error_msg}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"ERROR: Request exception fetching customer details: {str(e)}")
            if hasattr(e, 'response') and e.response:
                try:
                    error_data = e.response.json()
                    logger.error(f"Zoho API error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"ERROR: Exception fetching customer details: {str(e)}")
            return None

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

    def validate_usd_price_list_setup(self) -> Dict[str, Any]:
        """Validate USD price list configuration"""
        usd_price_list_id = os.getenv('ZOHO_USD_PRICE_LIST_ID')
        fallback_price_list_id = os.getenv('ZOHO_PRICE_LIST_ID')
        
        validation_result = {
            "usd_price_list_configured": bool(usd_price_list_id),
            "usd_price_list_id": usd_price_list_id,
            "fallback_price_list_id": fallback_price_list_id,
            "status": "success" if usd_price_list_id else "warning",
            "message": ""
        }
        
        if usd_price_list_id:
            validation_result["message"] = "USD price list is properly configured"
            logger.info(f"USD price list validation: SUCCESS - Using USD price list {usd_price_list_id}")
        else:
            validation_result["message"] = "USD price list not configured - prices will display in base currency (INR)"
            logger.warning("USD price list validation: WARNING - ZOHO_USD_PRICE_LIST_ID not set")
        
        return validation_result



    def get_subscription_details(self, subscription_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch subscription details from Zoho. Used to read current addon quantities so that
        standalone recurring addon purchases can set additive quantities and avoid downgrade flags.
        """
        try:
            url = f"{self.base_url}/subscriptions/{subscription_id}"
            headers = self._get_headers()
            response = requests.get(url, headers=headers)

            if response.status_code == 401:
                headers = self._get_headers(force_refresh=True)
                response = requests.get(url, headers=headers)

            response.raise_for_status()
            data = response.json()
            # Expected top-level keys: code, subscription
            return data
        except Exception as e:
            logger.error(f"Error fetching subscription details for {subscription_id}: {str(e)}")
            return None

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
            
            # Get the USD price list ID from environment variables
            # Use USD price list to show all prices in USD globally
            price_list_id = os.getenv('ZOHO_USD_PRICE_LIST_ID') or os.getenv('ZOHO_PRICE_LIST_ID')
            print(f"Pricebook ID (USD): {price_list_id}")
            
            # Prepare the payload according to Zoho API docs for buyonetimeaddon
            payload = {
                "subscription_id": subscription_id,
                "addons": addon_data["addons"]
            }
            
            # Add required URLs
            if addon_data.get("redirect_url"):
                payload["redirect_url"] = addon_data["redirect_url"]
            if addon_data.get("cancel_url"):
                payload["cancel_url"] = addon_data["cancel_url"]
            
            # Add pricebook_id if available - this is often required for buyonetimeaddon
            if price_list_id:
                payload["pricebook_id"] = price_list_id
                print(f"Added USD pricebook_id to addon checkout payload: {price_list_id}")
                logger.info(f"Using USD pricebook for addon checkout: {price_list_id}")
            else:
                print("WARNING: ZOHO_USD_PRICE_LIST_ID not set in environment variables")
                # For buyonetimeaddon, pricebook_id might be required
                logger.warning("USD pricebook_id is missing - addon prices might display in base currency (INR) instead of USD")
            
            # Add customer information if provided - required for standalone addon purchases
            if "customer" in addon_data and addon_data["customer"]:
                # Ensure customer has all required fields for buyonetimeaddon
                customer = addon_data["customer"]
                if customer.get("email") and customer.get("display_name"):
                    payload["customer"] = {
                        "display_name": customer.get("display_name"),
                        "email": customer.get("email")
                    }
                    # Add optional fields if available
                    if customer.get("mobile"):
                        payload["customer"]["mobile"] = customer.get("mobile")
                    if customer.get("company_name"):
                        payload["customer"]["company_name"] = customer.get("company_name")
                    print(f"Added customer data to payload: {payload['customer']}")
                else:
                    print("WARNING: Customer email and display_name are required for buyonetimeaddon")
                    logger.warning("Missing required customer fields (email, display_name) for buyonetimeaddon")
                
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
    addon_codes: List[str] = None,
    existing_customer_id: str = None,
    billing_address: Dict[str, Any] = None,
    shipping_address: Dict[str, Any] = None,
    gstin: str = None
) -> Dict[str, Any]:
    """
    Format subscription data for Zoho Hosted Page checkout
    
    Note: For NEW customers (existing_customer_id=None), we deliberately don't send 
    user account data to force Zoho to collect billing address, shipping address, 
    and complete account info during the checkout process.
    
    For EXISTING customers, we only send the customer_id to avoid duplicates.
    """
    
    # Get the frontend URL from environment variables or use default
    frontend_url = os.getenv('FRONTEND_URL', 'https://evolra.ai')
    
    # Get the USD price list ID from environment variables  
    # Use USD price list to show all prices in USD globally
    price_list_id = os.getenv('ZOHO_USD_PRICE_LIST_ID') or os.getenv('ZOHO_PRICE_LIST_ID')
    
    # Enhanced debugging logs
    print(f"\n==== DEBUG: Creating Zoho Checkout Payload ====")
    print(f"User ID: {user_id}")
    print(f"User Data: {user_data}")
    print(f"Plan Code: {plan_code}")
    print(f"Addon Codes (received): {addon_codes}")
    print(f"Existing Customer ID: {existing_customer_id}")
    print(f"Pricebook ID: {price_list_id}")
    print(f"Billing Address: {billing_address}")
    print(f"Shipping Address: {shipping_address}")
    print(f"GSTIN: {gstin}")
    
    if not addon_codes:
        print("WARNING: No addon codes were provided")
    elif len(addon_codes) == 0:
        print("WARNING: Empty addon_codes list was provided")
    
    billing_state = billing_address.get('state') if billing_address else None
    billing_country = billing_address.get('country') if billing_address else None

    should_apply_tax = (
        billing_country 
        and billing_country.lower() in ["india", "in", "ind"]  
        and billing_state 
        and billing_state.lower() not in ["rajasthan", "rj"]
    )
    
    subscription_data = {
        "plan": {
            "plan_code": plan_code,
            "quantity": 1,  # Required by Zoho Billing
        },
        "redirect_url": f"{frontend_url}/dashboard/welcome?payment=success",  # Redirect to dashboard after successful payment
        "cancel_url": f"{frontend_url}/subscription",  # Redirect back to subscription page if cancelled
        # Configure address collection settings
        "collect_billing_address": True,  # Enable billing address collection
        "collect_shipping_address": True,  # Enable shipping address collection
        "auto_populate_address": False  # Prevent pre-filling with default addresses
    }
   
    # Apply tax only if country = India and state != Rajasthan
    if should_apply_tax and settings.ZOHO_TAX_ID:
        subscription_data["plan"]["tax_id"] = settings.ZOHO_TAX_ID
        subscription_data["plan"]["tax_exemption_code"] = ""
         
    # Handle customer data based on whether they're existing or new
    if existing_customer_id:
        # For existing customers, include ID and customer details so hosted page shows account info
        customer_data = {
            "customer_id": existing_customer_id,
            "display_name": user_data.get("name", "") or (user_data.get("email", "").split("@")[0]),
            "email": user_data.get("email", ""),
            "mobile": user_data.get("phone_no", ""),
            "company_name": user_data.get("company_name", "")
        }

        if billing_address:
            customer_data["billing_address"] = {
                "attention": f"{billing_address.get('firstName', '')} {billing_address.get('lastName', '')}".strip(),
                "address": billing_address.get('address1', ''),
                "street2": billing_address.get('address2', ''),
                "city": billing_address.get('city', ''),
                "state": billing_address.get('state', ''),
                "zip": billing_address.get('zipCode', ''),
                "country": billing_address.get('country', ''),
                "fax": ""
            }

        if shipping_address:
            customer_data["shipping_address"] = {
                "attention": f"{shipping_address.get('firstName', '')} {shipping_address.get('lastName', '')}".strip(),
                "address": shipping_address.get('address1', ''),
                "street2": shipping_address.get('address2', ''),
                "city": shipping_address.get('city', ''),
                "state": shipping_address.get('state', ''),
                "zip": shipping_address.get('zipCode', ''),
                "country": shipping_address.get('country', ''),
                "fax": ""
            }

        subscription_data["customer"] = customer_data
        print(f"Using existing customer ID: {existing_customer_id} with customer details included")
    else:
        # For NEW customers, include basic contact info and address if provided
        customer_data = {
            "display_name": user_data.get("name", ""),
            "email": user_data.get("email", ""),
            "mobile": user_data.get("phone_no", ""),
            "company_name": user_data.get("company_name", "")
        }
        
        # Add billing address if provided
        if billing_address:
            customer_data["billing_address"] = {
                "attention": f"{billing_address.get('firstName', '')} {billing_address.get('lastName', '')}".strip(),
                "address": billing_address.get('address1', ''),
                "street2": billing_address.get('address2', ''),
                "city": billing_address.get('city', ''),
                "state": billing_address.get('state', ''),
                "zip": billing_address.get('zipCode', ''),
                "country": billing_address.get('country', ''),
                "fax": ""  # Optional field
            }
            print(f"Added billing address to customer data")
            
        # Add shipping address if provided  
        if shipping_address:
            customer_data["shipping_address"] = {
                "attention": f"{shipping_address.get('firstName', '')} {shipping_address.get('lastName', '')}".strip(),
                "address": shipping_address.get('address1', ''),
                "street2": shipping_address.get('address2', ''),
                "city": shipping_address.get('city', ''),
                "state": shipping_address.get('state', ''),
                "zip": shipping_address.get('zipCode', ''),
                "country": shipping_address.get('country', ''),
                "fax": ""  # Optional field
            }
            print(f"Added shipping address to customer data")
            
        # Add custom fields for GSTIN if provided
        if gstin:
            customer_data["custom_fields"] = [
                {
                    "field_name": "cf_gstin",
                    "value": gstin
                }
            ]
            print(f"Added GSTIN to customer data: {gstin}")
            
        subscription_data["customer"] = customer_data
        print("New customer - included address data for Zoho checkout")
    
    # Add pricebook_id if available
    if price_list_id:
        subscription_data["pricebook_id"] = price_list_id
        print(f"Added USD pricebook_id to checkout payload: {price_list_id}")
        logger.info(f"Using USD pricebook for subscription checkout: {price_list_id}")
    else:
        print("WARNING: ZOHO_USD_PRICE_LIST_ID not set in environment variables")
        logger.warning("USD pricebook_id is missing - subscription prices might display in base currency (INR) instead of USD")
    
       
    # Add addons if provided
    if addon_codes and len(addon_codes) > 0:
        print(f"Adding addons to the checkout payload")
        
        # Count occurrences of each addon code to handle multiple selections of the same addon
        addon_counts = {}
        for code in addon_codes:
            addon_counts[code] = addon_counts.get(code, 0) + 1
        
        # Create the addons array with correct quantities
        # subscription_data["addons"] = [
        #     {"addon_code": code, "quantity": count} 
        #     for code, count in addon_counts.items()
        # ]

        subscription_data["addons"] = [
            {
                "addon_code": code, 
                "quantity": count,
                # Apply tax to each addon if needed
                **({"tax_id": settings.ZOHO_TAX_ID, "tax_exemption_code": ""} if should_apply_tax and settings.ZOHO_TAX_ID else {})
            } 
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