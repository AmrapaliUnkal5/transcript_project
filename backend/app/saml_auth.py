import os
import base64
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote_plus
from xml.sax.saxutils import escape

from fastapi import APIRouter, Request, HTTPException, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.dependency import get_db
from app.models import User
from app.config import settings
from app.utils.logger import get_module_logger
from app.utils.certificate_manager import CertificateManager

# Import cryptography for XML signing
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from lxml import etree
import hashlib

# Initialize logger and router
logger = get_module_logger(__name__)
router = APIRouter(prefix="/auth/saml", tags=["SAML SSO"])

# Initialize certificate manager
cert_manager = CertificateManager(cert_dir=os.path.join(os.getcwd(), "certificates"))

class SimpleSAMLService:
    """Simplified SAML Service for Zoho SSO"""
    
    def __init__(self):
        self.issuer = os.getenv('SAML_ISSUER', 'https://evolra.ai')
        self.acs_url = os.getenv('ZOHO_SAML_ACS_URL', '')
        self.relay_state = os.getenv('ZOHO_SAML_RELAY_STATE', '')
        
    def generate_signed_saml_response(self, user: User, request_id: str = None) -> str:
        """Generate signed SAML response for Zoho"""
        try:
            # Get existing certificate pair using certificate manager
            private_key_pem, public_cert_pem = cert_manager.get_or_create_certificate_pair()
            
            # Load private key for signing
            private_key = serialization.load_pem_private_key(
                private_key_pem.encode('utf-8'),
                password=None,
            )

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
            
            # Create SAML response XML
            saml_response_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" 
                 xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"
                 xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                 ID="{response_id}" 
                 Version="2.0" 
                 IssueInstant="{issue_instant_str}" 
                 Destination="{escape(self.acs_url)}"
                 {f'InResponseTo="{escape(request_id)}"' if request_id else ''}>
    <saml2:Issuer>{escape(self.issuer)}</saml2:Issuer>
    <saml2p:Status>
        <saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
    </saml2p:Status>
    <saml2:Assertion ID="{assertion_id}" 
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
            <saml2:Attribute Name="EmailAddress">
                <saml2:AttributeValue>{escape(user.email)}</saml2:AttributeValue>
            </saml2:Attribute>
            <saml2:Attribute Name="firstName">
                <saml2:AttributeValue>{escape(getattr(user, 'name', user.email.split('@')[0]))}</saml2:AttributeValue>
            </saml2:Attribute>
            <saml2:Attribute Name="lastName">
                <saml2:AttributeValue>{escape(getattr(user, 'name', user.email.split('@')[0]))}</saml2:AttributeValue>
            </saml2:Attribute>
            <saml2:Attribute Name="displayName">
                <saml2:AttributeValue>{escape(getattr(user, 'name', user.email.split('@')[0]))}</saml2:AttributeValue>
            </saml2:Attribute>
            <saml2:Attribute Name="username">
                <saml2:AttributeValue>{escape(user.email)}</saml2:AttributeValue>
            </saml2:Attribute>
        </saml2:AttributeStatement>
    </saml2:Assertion>
</saml2p:Response>"""
            
            # Parse XML
            doc = etree.fromstring(saml_response_xml.encode('utf-8'))
            
            # Sign the assertion
            signed_doc = self._sign_saml_assertion(doc, assertion_id, private_key, public_cert_pem)
            
            # Convert back to string
            signed_xml = etree.tostring(signed_doc, encoding='unicode', method='xml')
            
            # Debug: Log the XML structure for troubleshooting
            logger.debug(f"Generated SAML XML: {signed_xml[:500]}...")
            
            # Base64 encode the response
            encoded_response = base64.b64encode(signed_xml.encode('utf-8')).decode('utf-8')
            
            logger.info(f"Generated signed SAML response for user: {user.email}")
            logger.debug(f"Base64 encoded response: {encoded_response[:100]}...")
            return encoded_response
            
        except Exception as e:
            logger.error(f"Error generating SAML response: {str(e)}")
            raise

    def _sign_saml_assertion(self, doc: etree.Element, assertion_id: str, private_key, public_cert_pem: str) -> etree.Element:
        """Sign the SAML assertion using XML digital signatures"""
        try:
            # Find the assertion to sign
            ns = {
                'saml2': 'urn:oasis:names:tc:SAML:2.0:assertion',
                'saml2p': 'urn:oasis:names:tc:SAML:2.0:protocol',
                'ds': 'http://www.w3.org/2000/09/xmldsig#'
            }
            
            assertion = doc.find(f".//saml2:Assertion[@ID='{assertion_id}']", ns)
            if assertion is None:
                logger.error(f"Assertion with ID {assertion_id} not found")
                raise Exception(f"Assertion with ID {assertion_id} not found")
                
            logger.debug(f"Signing assertion with ID: {assertion_id}")
            
            # Ensure assertion has proper namespace declarations
            assertion.set("{http://www.w3.org/2000/09/xmldsig#}ds", "http://www.w3.org/2000/09/xmldsig#")
            
            # Create signature element with proper namespace
            sig_elem = etree.Element("{http://www.w3.org/2000/09/xmldsig#}Signature", nsmap={'ds': 'http://www.w3.org/2000/09/xmldsig#'})
            
            # Create SignedInfo
            signed_info = etree.SubElement(sig_elem, "{http://www.w3.org/2000/09/xmldsig#}SignedInfo")
            
            # Canonicalization method - use inclusive C14N for better compatibility
            canon_method = etree.SubElement(signed_info, "{http://www.w3.org/2000/09/xmldsig#}CanonicalizationMethod")
            canon_method.set("Algorithm", "http://www.w3.org/2001/10/xml-exc-c14n#")
            
            # Signature method
            sig_method = etree.SubElement(signed_info, "{http://www.w3.org/2000/09/xmldsig#}SignatureMethod")
            sig_method.set("Algorithm", "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256")
            
            # Reference
            reference = etree.SubElement(signed_info, "{http://www.w3.org/2000/09/xmldsig#}Reference")
            reference.set("URI", f"#{assertion_id}")
            
            # Transforms
            transforms = etree.SubElement(reference, "{http://www.w3.org/2000/09/xmldsig#}Transforms")
            transform1 = etree.SubElement(transforms, "{http://www.w3.org/2000/09/xmldsig#}Transform")
            transform1.set("Algorithm", "http://www.w3.org/2000/09/xmldsig#enveloped-signature")
            transform2 = etree.SubElement(transforms, "{http://www.w3.org/2000/09/xmldsig#}Transform")
            transform2.set("Algorithm", "http://www.w3.org/2001/10/xml-exc-c14n#")
            
            # Digest method
            digest_method = etree.SubElement(reference, "{http://www.w3.org/2000/09/xmldsig#}DigestMethod")
            digest_method.set("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256")
            
            # Insert signature into assertion BEFORE calculating digest
            # Insert signature after issuer in assertion
            issuer = assertion.find(".//saml2:Issuer", ns)
            if issuer is not None:
                # Insert after issuer in the assertion
                issuer.getparent().insert(list(issuer.getparent()).index(issuer) + 1, sig_elem)
            else:
                # If not found, insert as second element
                assertion.insert(1, sig_elem)
            
            # Now calculate digest of the assertion WITH the signature element (for enveloped signature)
            # Create a temporary copy for digest calculation
            temp_assertion = etree.fromstring(etree.tostring(assertion))
            
            # Apply enveloped signature transform (remove signature elements)
            signature_elements = temp_assertion.xpath('.//ds:Signature', namespaces={'ds': 'http://www.w3.org/2000/09/xmldsig#'})
            for sig in signature_elements:
                sig.getparent().remove(sig)
            
            # Apply exclusive canonicalization
            assertion_c14n = etree.tostring(temp_assertion, method='c14n', exclusive=True, with_comments=False)
            digest_value = base64.b64encode(hashlib.sha256(assertion_c14n).digest()).decode('utf-8')
            
            logger.debug(f"Calculated digest: {digest_value}")
            
            digest_value_elem = etree.SubElement(reference, "{http://www.w3.org/2000/09/xmldsig#}DigestValue")
            digest_value_elem.text = digest_value
            
            # Calculate signature of SignedInfo
            signed_info_c14n = etree.tostring(signed_info, method='c14n', exclusive=True, with_comments=False)
            signature = private_key.sign(signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
            signature_value = base64.b64encode(signature).decode('utf-8')
            
            logger.debug(f"Generated signature value: {signature_value[:50]}...")
            
            # Add signature value
            sig_value_elem = etree.SubElement(sig_elem, "{http://www.w3.org/2000/09/xmldsig#}SignatureValue")
            sig_value_elem.text = signature_value
            
            # Add key info
            key_info = etree.SubElement(sig_elem, "{http://www.w3.org/2000/09/xmldsig#}KeyInfo")
            x509_data = etree.SubElement(key_info, "{http://www.w3.org/2000/09/xmldsig#}X509Data")
            x509_cert = etree.SubElement(x509_data, "{http://www.w3.org/2000/09/xmldsig#}X509Certificate")
            
            # Clean certificate content properly
            cert_content = public_cert_pem
            cert_content = cert_content.replace('-----BEGIN CERTIFICATE-----', '')
            cert_content = cert_content.replace('-----END CERTIFICATE-----', '')
            cert_content = cert_content.replace('\n', '').replace('\r', '').replace(' ', '')
            
            x509_cert.text = cert_content
            
            logger.info(f"Successfully signed assertion with ID: {assertion_id}")
            return doc
            
        except Exception as e:
            logger.error(f"Error signing SAML assertion: {str(e)}")
            raise

# Initialize SAML service
saml_service = SimpleSAMLService()

def get_current_user_from_token(request: Request) -> Optional[User]:
    """Extract and validate user from JWT token in request"""
    try:
        # Try to get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split("Bearer ")[1]
        else:
            # Try to get token from cookie
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
    Simple SAML SSO login endpoint for Zoho
    """
    print(f"SAMLRequest: {SAMLRequest}")
    try:
        logger.info(f"SAML login request received. RelayState: {RelayState}")
        
        # Check if user is already authenticated
        user = get_current_user_from_token(request)
        
        if not user:
            print("User not authenticated, redirecting to login")
            # User not authenticated, redirect to login
            frontend_url = os.getenv('FRONTEND_URL', 'https://evolra.ai')
            login_url = f"{frontend_url}/login"
            
            # Store SAML parameters for return
            return_params = {
                'saml_relay_state': RelayState or '',
                'saml_request': SAMLRequest or '',
                'redirect_to': 'saml_continue'
            }
            
            param_string = '&'.join([f"{k}={quote_plus(str(v))}" for k, v in return_params.items()])
            redirect_url = f"{login_url}?{param_string}"
            
            logger.info(f"User not authenticated, redirecting to: {redirect_url}")
            return RedirectResponse(url=redirect_url, status_code=302)
        
        # User is authenticated, generate SAML response
        print("User authenticated, generating SAML response")
        logger.info(f"User authenticated: {user.email}, generating SAML response")
        
        # Extract request ID if present
        request_id = None
        if SAMLRequest:
            try:
                decoded_request = base64.b64decode(SAMLRequest).decode('utf-8')
                if 'ID="' in decoded_request:
                    request_id = decoded_request.split('ID="')[1].split('"')[0]
            except Exception as e:
                logger.warning(f"Could not parse SAMLRequest: {str(e)}")
        
        # Generate signed SAML response
        saml_response = saml_service.generate_signed_saml_response(user, request_id)
        print(f"Generated SAML response length: {len(saml_response)} characters")
        print(f"SAML response (first 200 chars): {saml_response}")
        
        # Create HTML form for auto-posting to Zoho
        html_form = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to Zoho...</title>
        </head>
        <body>
            <form id="saml-form" method="post" action="{saml_service.acs_url}">
                <input type="hidden" name="SAMLResponse" value="{saml_response}" />
                <input type="hidden" name="RelayState" value="{RelayState or saml_service.relay_state}" />
                <noscript>
                    <input type="submit" value="Continue to Zoho" />
                </noscript>
            </form>
            <script>
                document.getElementById('saml-form').submit();
            </script>
            <div style="text-align: center; margin-top: 50px;">
                <p>Redirecting to Zoho...</p>
                <p>If not redirected automatically, click the button above.</p>
            </div>
        </body>
        </html>
        """
        
        logger.info("Returning SAML response form for Zoho")
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

@router.get("/metadata")
async def saml_metadata():
    """
    SAML metadata endpoint for Zoho configuration
    """
    try:
        # Get public certificate using certificate manager
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