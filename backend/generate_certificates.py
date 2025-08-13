#!/usr/bin/env python3
"""
Script to generate initial SAML certificates for SSO setup
Run this script once to create the certificate pair needed for SAML SSO
"""

import os
import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.utils.certificate_manager import CertificateManager

def main():
    """Generate initial SAML certificates"""
    print("=== Generating SAML Certificates for SSO ===")
    
    try:
        # Initialize certificate manager
        cert_manager = CertificateManager()
        
        # Generate certificate pair
        private_key, public_cert = cert_manager.get_or_create_certificate_pair()
        
        print("✅ Certificate pair generated successfully!")
        print(f"📁 Private key saved to: {cert_manager.private_key_file}")
        print(f"📁 Public certificate saved to: {cert_manager.public_cert_file}")
        
        # Get certificate for Zoho configuration
        zoho_cert = cert_manager.get_public_cert_for_zoho()
        print("\n=== Certificate for Zoho Configuration ===")
        print("Copy this certificate content to your Zoho Billing SSO settings:")
        print("-" * 50)
        print(zoho_cert)
        print("-" * 50)
        
        print("\n=== Next Steps ===")
        print("1. Copy the certificate content above to Zoho Billing SSO configuration")
        print("2. Set the following environment variables:")
        print("   - ZOHO_SAML_ACS_URL: Your Zoho ACS URL")
        print("   - ZOHO_SAML_RELAY_STATE: Your Zoho Relay State")
        print("3. Restart your application")
        print("4. Test SSO by clicking 'Manage Subscription' in your app")
        
    except Exception as e:
        print(f"❌ Error generating certificates: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 