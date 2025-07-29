import os
import base64
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from urllib.parse import quote_plus
from xml.sax.saxutils import escape

from fastapi import APIRouter, Request, HTTPException, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.dependency import get_db
from app.models import User
from app.config import settings
from app.utils.certificate_manager import CertificateManager
from app.utils.logger import get_module_logger

# Initialize logger and router
logger = get_module_logger(__name__)
router = APIRouter(prefix="/auth/saml", tags=["SAML SSO"])

# Initialize certificate manager
cert_manager = CertificateManager(cert_dir=os.path.join(os.getcwd(), "certificates"))

class SAMLService:
    """Service for handling SAML SSO as Identity Provider"""
    
    def __init__(self):
        self.issuer = os.getenv('SAML_ISSUER', 'https://evolra.ai')
        self.acs_url = os.getenv('ZOHO_SAML_ACS_URL', '')
        self.relay_state = os.getenv('ZOHO_SAML_RELAY_STATE', '')
        
    def generate_saml_response(self, user: User, request_id: str = None) -> str:
        """Generate SAML response for authenticated user"""
        try:
            # Get certificate for signing
            private_key_pem, public_cert_pem = cert_manager.get_or_create_certificate_pair()
            
            # Generate unique IDs
            response_id = f"_response_{uuid.uuid4().hex}"
            assertion_id = f"_assertion_{uuid.uuid4().hex}"
            
            # Set validity times
            issue_instant = datetime.utcnow()
            not_before = issue_instant
            not_on_or_after = issue_instant + timedelta(minutes=5)
            
            # Format times for SAML
            issue_instant_str = issue_instant.strftime('%Y-%m-%dT%H:%M:%SZ')
            not_before_str = not_before.strftime('%Y-%m-%dT%H:%M:%SZ')
            not_on_or_after_str = not_on_or_after.strftime('%Y-%m-%dT%H:%M:%SZ')
            
            # Create SAML assertion
            saml_assertion = f"""
                <saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" 
                                ID="{assertion_id}" 
                                IssueInstant="{issue_instant_str}" 
                                Version="2.0">
                    <saml2:Issuer>{escape(self.issuer)}</saml2:Issuer>
                    <saml2:Subject>
                        <saml2:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                            {escape(user.email)}
                        </saml2:NameID>
                        <saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
                            <saml2:SubjectConfirmationData NotOnOrAfter="{not_on_or_after_str}" 
                                                          Recipient="{escape(self.acs_url)}"/>
                        </saml2:SubjectConfirmation>
                    </saml2:Subject>
                    <saml2:Conditions NotBefore="{not_before_str}" NotOnOrAfter="{not_on_or_after_str}">
                        <saml2:AudienceRestriction>
                            <saml2:Audience>zoho.com</saml2:Audience>
                        </saml2:AudienceRestriction>
                    </saml2:Conditions>
                    <saml2:AuthnStatement AuthnInstant="{issue_instant_str}">
                        <saml2:AuthnContext>
                            <saml2:AuthnContextClassRef>
                                urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
                            </saml2:AuthnContextClassRef>
                        </saml2:AuthnContext>
                    </saml2:AuthnStatement>
                    <saml2:AttributeStatement>
                        <saml2:Attribute Name="email">
                            <saml2:AttributeValue>{escape(user.email)}</saml2:AttributeValue>
                        </saml2:Attribute>
                        <saml2:Attribute Name="firstName">
                            <saml2:AttributeValue>{escape(user.name or '')}</saml2:AttributeValue>
                        </saml2:Attribute>
                        <saml2:Attribute Name="lastName">
                            <saml2:AttributeValue>{escape(user.name or '')}</saml2:AttributeValue>
                        </saml2:Attribute>
                    </saml2:AttributeStatement>
                </saml2:Assertion>
            """.strip()
            
            # Create SAML response
            saml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" 
                 xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"
                 ID="{response_id}" 
                 Version="2.0" 
                 IssueInstant="{issue_instant_str}" 
                 Destination="{escape(self.acs_url)}"
                 {f'InResponseTo="{escape(request_id)}"' if request_id else ''}>
    <saml2:Issuer>{escape(self.issuer)}</saml2:Issuer>
    <saml2p:Status>
        <saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
    </saml2p:Status>
    {saml_assertion}
</saml2p:Response>"""
            
            # Base64 encode the response
            encoded_response = base64.b64encode(saml_response.encode('utf-8')).decode('utf-8')
            
            logger.info(f"Generated SAML response for user: {user.email}")
            return encoded_response
            
        except Exception as e:
            logger.error(f"Error generating SAML response: {str(e)}")
            raise

# Initialize SAML service
saml_service = SAMLService()

def get_current_user_from_token(request: Request) -> Optional[User]:
    """Extract and validate user from JWT token in request"""
    try:
        # Try to get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split("Bearer ")[1]
        else:
            # Try to get token from cookie (if you use cookies)
            token = request.cookies.get("access_token")
            
        if not token:
            return None
            
        # Decode JWT token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_email = payload.get("sub")
        
        if not user_email:
            return None
            
        # Get user from database
        db = next(get_db())
        user = db.query(User).filter(User.email == user_email).first()
        db.close()
        
        return user
        
    except JWTError:
        logger.warning("Invalid JWT token in SAML request")
        return None
    except Exception as e:
        logger.error(f"Error extracting user from token: {str(e)}")
        return None

@router.get("/login")
async def saml_login(request: Request, 
                    RelayState: str = None,
                    SAMLRequest: str = None):
    """
    SAML SSO login endpoint - acts as Identity Provider
    This is where Zoho will redirect users for authentication
    """
    try:
        logger.info(f"SAML login request received. RelayState: {RelayState}")
        
        # Check if user is already authenticated
        user = get_current_user_from_token(request)
        
        if not user:
            # User not authenticated, redirect to login with return URL
            frontend_url = os.getenv('FRONTEND_URL', 'https://evolra.ai')
            login_url = f"{frontend_url}/login"
            
            # Store the original SAML request parameters in session/state
            return_params = {
                'saml_relay_state': RelayState or '',
                'saml_request': SAMLRequest or '',
                'redirect_to': 'saml_continue'
            }
            
            # Encode parameters for URL
            param_string = '&'.join([f"{k}={quote_plus(str(v))}" for k, v in return_params.items()])
            redirect_url = f"{login_url}?{param_string}"
            
            logger.info(f"User not authenticated, redirecting to: {redirect_url}")
            return RedirectResponse(url=redirect_url, status_code=302)
        
        # User is authenticated, generate SAML response
        logger.info(f"User authenticated: {user.email}, generating SAML response")
        
        # Extract request ID if present (for InResponseTo)
        request_id = None
        if SAMLRequest:
            try:
                # Decode and parse SAML request to get ID (simplified)
                decoded_request = base64.b64decode(SAMLRequest).decode('utf-8')
                # Basic parsing to extract ID (you might want to use proper XML parsing)
                if 'ID="' in decoded_request:
                    request_id = decoded_request.split('ID="')[1].split('"')[0]
            except Exception as e:
                logger.warning(f"Could not parse SAMLRequest: {str(e)}")
        
        # Generate SAML response
        saml_response = saml_service.generate_saml_response(user, request_id)
        
        # Create HTML form for auto-posting to Zoho ACS URL
        html_form = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to Zoho Billing...</title>
        </head>
        <body>
            <form id="saml-form" method="post" action="{saml_service.acs_url}">
                <input type="hidden" name="SAMLResponse" value="{saml_response}" />
                <input type="hidden" name="RelayState" value="{RelayState or saml_service.relay_state}" />
                <noscript>
                    <input type="submit" value="Continue to Zoho Billing" />
                </noscript>
            </form>
            <script>
                document.getElementById('saml-form').submit();
            </script>
            <div style="text-align: center; margin-top: 50px;">
                <p>Redirecting to Zoho Billing...</p>
                <p>If you are not redirected automatically, please click the button above.</p>
            </div>
        </body>
        </html>
        """
        
        logger.info("Returning SAML response form for auto-post to Zoho")
        return HTMLResponse(content=html_form)
        
    except Exception as e:
        logger.error(f"Error in SAML login: {str(e)}")
        raise HTTPException(status_code=500, detail="SAML authentication error")

@router.post("/login")
async def saml_login_post(request: Request,
                         RelayState: str = Form(None),
                         SAMLRequest: str = Form(None)):
    """Handle POST requests to SAML login endpoint"""
    return await saml_login(request, RelayState, SAMLRequest)

@router.get("/logout")
async def saml_logout(request: Request, 
                     SAMLRequest: str = None,
                     RelayState: str = None):
    """
    SAML SSO logout endpoint
    Handle logout requests from Zoho
    """
    try:
        logger.info("SAML logout request received")
        
        # You can add logout logic here if needed
        # For now, just redirect to your app's logout or home page
        frontend_url = os.getenv('FRONTEND_URL', 'https://evolra.ai')
        logout_url = f"{frontend_url}/login?logged_out=true"
        
        return RedirectResponse(url=logout_url, status_code=302)
        
    except Exception as e:
        logger.error(f"Error in SAML logout: {str(e)}")
        raise HTTPException(status_code=500, detail="SAML logout error")

@router.get("/metadata")
async def saml_metadata():
    """
    SAML metadata endpoint
    Provides metadata about this Identity Provider for Zoho configuration
    """
    try:
        # Get public certificate
        _, public_cert_pem = cert_manager.get_or_create_certificate_pair()
        
        # Remove PEM headers for metadata
        cert_content = public_cert_pem.replace('-----BEGIN CERTIFICATE-----\n', '')
        cert_content = cert_content.replace('\n-----END CERTIFICATE-----\n', '')
        cert_content = cert_content.replace('\n', '')
        
        base_url = os.getenv('SERVER_URL', 'http://localhost:8000')
        
        metadata = f"""<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="{saml_service.issuer}">
    <md:IDPSSODescriptor WantAuthnRequestsSigned="false" 
                         protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:KeyDescriptor use="signing">
            <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                <ds:X509Data>
                    <ds:X509Certificate>{cert_content}</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                               Location="{base_url}/auth/saml/login"/>
        <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                               Location="{base_url}/auth/saml/login"/>
        <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                               Location="{base_url}/auth/saml/logout"/>
    </md:IDPSSODescriptor>
</md:EntityDescriptor>"""
        
        return HTMLResponse(content=metadata, media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error generating SAML metadata: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating metadata")

@router.get("/certificate")
async def get_public_certificate():
    """
    Endpoint to get the public certificate for Zoho configuration
    Returns the certificate in the format required by Zoho
    """
    try:
        cert_content = cert_manager.get_public_cert_for_zoho()
        return {
            "certificate": cert_content,
            "message": "Copy this certificate content to Zoho Billing SSO configuration"
        }
    except Exception as e:
        logger.error(f"Error getting public certificate: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving certificate") 