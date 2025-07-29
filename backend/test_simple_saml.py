#!/usr/bin/env python3
"""
Simple test script for the simplified SAML SSO implementation
"""

import os
import sys
import requests
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_saml_endpoints():
    """Test basic SAML endpoints"""
    
    base_url = os.getenv('SERVER_URL', 'http://localhost:8000')
    
    print("🧪 Testing Simple SAML SSO Implementation")
    print("=" * 50)
    
    # Test 1: Metadata endpoint
    print("\n1. Testing SAML Metadata endpoint...")
    try:
        response = requests.get(f"{base_url}/auth/saml/metadata")
        if response.status_code == 200:
            print("✅ Metadata endpoint working")
            print(f"   Content length: {len(response.text)} chars")
        else:
            print(f"❌ Metadata endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Metadata endpoint error: {e}")
    
    # Test 2: Login endpoint (without auth - should redirect)
    print("\n2. Testing SAML Login endpoint (unauthenticated)...")
    try:
        response = requests.get(f"{base_url}/auth/saml/login", allow_redirects=False)
        if response.status_code in [302, 307]:
            print("✅ Login endpoint redirects unauthenticated users")
            if 'location' in response.headers:
                print(f"   Redirects to: {response.headers['location']}")
        else:
            print(f"❌ Login endpoint unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Login endpoint error: {e}")
    
    # Test 3: Environment variables
    print("\n3. Checking Environment Configuration...")
    required_vars = [
        'SAML_ISSUER',
        'ZOHO_SAML_ACS_URL',
        'SERVER_URL',
        'FRONTEND_URL'
    ]
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value}")
        else:
            print(f"⚠️  {var}: Not set (optional)")
    
    print("\n" + "=" * 50)
    print("🎉 Simple SAML Implementation Test Complete!")
    print("\nNext steps:")
    print("1. Ensure environment variables are configured")
    print("2. Set up Zoho with your metadata URL")
    print("3. Test with authenticated user")

def test_simple_saml_service():
    """Test the SimpleSAMLService class directly"""
    
    print("\n🔧 Testing SimpleSAMLService...")
    
    try:
        from app.saml_auth import SimpleSAMLService
        from app.models import User
        
        # Create mock user
        user = User()
        user.email = "test@evolra.ai"
        user.name = "Test User"
        
        # Initialize service
        service = SimpleSAMLService()
        
        # Generate SAML response
        saml_response = service.generate_simple_saml_response(user)
        
        print("✅ SAML response generated successfully")
        print(f"   Response length: {len(saml_response)} chars")
        print(f"   Base64 encoded: {'=' in saml_response[-10:]}")
        
        # Decode and check content
        import base64
        decoded = base64.b64decode(saml_response).decode('utf-8')
        
        if 'test@evolra.ai' in decoded:
            print("✅ User email found in SAML response")
        else:
            print("❌ User email not found in SAML response")
            
        if 'saml2p:Response' in decoded:
            print("✅ Valid SAML response structure")
        else:
            print("❌ Invalid SAML response structure")
            
    except Exception as e:
        print(f"❌ SimpleSAMLService test failed: {e}")

if __name__ == "__main__":
    # Test endpoints
    test_saml_endpoints()
    
    # Test service class
    test_simple_saml_service() 