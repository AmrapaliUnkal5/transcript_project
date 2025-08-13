#!/usr/bin/env python3
"""
Script to generate Zoho OAuth tokens for the chatbot project
Run this script to get the authorization URL and exchange codes for tokens

Usage:
1. python generate_zoho_tokens.py - Shows authorization URL
2. python generate_zoho_tokens.py GRANT_CODE - Exchanges code for tokens
3. python generate_zoho_tokens.py --configure - Interactive configuration setup
"""

import os
import sys
import requests
from urllib.parse import urlencode
import json

# Add the parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration file path
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'zoho_config.json')

def load_config():
    """Load configuration from file or return defaults"""
    default_config = {
        "CLIENT_ID": "1000.7C5CLSPMV3A4TUX1U97T9M47LKA8YU",  # Update this for new org
        "CLIENT_SECRET": "14801b41902c49989df8a934fbb14209e76239f258",  # Update this for new org
        "REDIRECT_URI": "http://localhost:8000/oauth/callback",
        "ORGANIZATION_ID": "",  # Update this for new org
        "SCOPES": [
            "ZohoSubscriptions.hostedpages.CREATE",
            "ZohoSubscriptions.subscriptions.ALL", 
            "ZohoSubscriptions.plans.ALL",
            "ZohoSubscriptions.addons.ALL"
        ]
    }
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                # Merge with defaults to ensure all keys exist
                for key in default_config:
                    if key not in config:
                        config[key] = default_config[key]
                return config
        except Exception as e:
            print(f"Warning: Could not load config file: {e}")
    
    return default_config

def save_config(config):
    """Save configuration to file"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"✅ Configuration saved to {CONFIG_FILE}")
    except Exception as e:
        print(f"❌ Could not save config: {e}")

def configure_app():
    """Interactive configuration setup"""
    print("=== Zoho App Configuration ===")
    print("\nPlease provide your Zoho app credentials:")
    print("(You can find these in https://api-console.zoho.in/)")
    
    config = load_config()
    
    # Get Client ID
    client_id = input(f"\nClient ID [{config.get('CLIENT_ID', '')}]: ").strip()
    if client_id:
        config['CLIENT_ID'] = client_id
    
    # Get Client Secret
    client_secret = input(f"Client Secret [{config.get('CLIENT_SECRET', '')[:20]}...]: ").strip()
    if client_secret:
        config['CLIENT_SECRET'] = client_secret
    
    # Get Organization ID
    org_id = input(f"Organization ID [{config.get('ORGANIZATION_ID', '')}]: ").strip()
    if org_id:
        config['ORGANIZATION_ID'] = org_id
    
    # Get Redirect URI
    redirect_uri = input(f"Redirect URI [{config.get('REDIRECT_URI', '')}]: ").strip()
    if redirect_uri:
        config['REDIRECT_URI'] = redirect_uri
    
    save_config(config)
    
    print("\n✅ Configuration updated!")
    print("Now run: python generate_zoho_tokens.py")
    return config

def generate_auth_url():
    """Generate the authorization URL for Zoho OAuth"""
    
    config = load_config()
    
    # Check if configuration looks valid
    if not config['CLIENT_ID'] or config['CLIENT_ID'] == "1000.7C5CLSPMV3A4TUX1U97T9M47LKA8YU":
        print("⚠️  Warning: Using default CLIENT_ID. Please run with --configure first!")
        response = input("Continue anyway? (y/N): ").strip().lower()
        if response != 'y':
            print("Run: python generate_zoho_tokens.py --configure")
            return None
    
    params = {
        'scope': ' '.join(config['SCOPES']),
        'client_id': config['CLIENT_ID'],
        'response_type': 'code',
        'access_type': 'offline',
        'prompt': 'consent',
        'redirect_uri': config['REDIRECT_URI']
    }
    
    auth_url = f"https://accounts.zoho.in/oauth/v2/auth?{urlencode(params)}"
    
    print("=== Zoho OAuth Token Generation ===")
    print(f"\n🏢 Organization ID: {config.get('ORGANIZATION_ID', 'Not configured')}")
    print(f"🔑 Client ID: {config['CLIENT_ID']}")
    print("\n1. Open this URL in your browser:")
    print("-" * 80)
    print(auth_url)
    print("-" * 80)
    print("\n2. After authorization, copy the 'code' parameter from the redirect URL")
    print("3. Run this script again with: python generate_zoho_tokens.py GRANT_CODE")
    print("\nExample redirect URL:")
    print("http://localhost:8000/oauth/callback?code=1000.abc123...")
    print("Copy the part after 'code=' as your GRANT_CODE")
    
    return auth_url

def exchange_code_for_tokens(grant_code):
    """Exchange grant code for access and refresh tokens"""
    
    config = load_config()
    
    data = {
        'code': grant_code,
        'client_id': config['CLIENT_ID'],
        'client_secret': config['CLIENT_SECRET'],
        'redirect_uri': config['REDIRECT_URI'],
        'grant_type': 'authorization_code'
    }
    
    try:
        print(f"\n=== Exchanging grant code for tokens ===")
        print(f"🏢 Organization ID: {config.get('ORGANIZATION_ID', 'Not configured')}")
        print(f"🔑 Client ID: {config['CLIENT_ID']}")
        print(f"📋 Grant code: {grant_code[:20]}...")
        
        response = requests.post('https://accounts.zoho.in/oauth/v2/token', data=data)
        
        print(f"🌐 Response status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            
            print("\n✅ SUCCESS! Tokens generated:")
            print("-" * 80)
            print(f"🎫 Access Token: {token_data.get('access_token', 'Not provided')}")
            print(f"🔄 Refresh Token: {token_data.get('refresh_token', 'Not provided')}")
            print(f"⏰ Expires In: {token_data.get('expires_in', 'Not provided')} seconds")
            print("-" * 80)
            
            print("\n📝 Add these to your .env file:")
            print("-" * 50)
            if config.get('ORGANIZATION_ID'):
                print(f"ZOHO_ORGANIZATION_ID={config['ORGANIZATION_ID']}")
            print(f"ZOHO_CLIENT_ID={config['CLIENT_ID']}")
            print(f"ZOHO_CLIENT_SECRET={config['CLIENT_SECRET']}")
            if token_data.get('refresh_token'):
                print(f"ZOHO_REFRESH_TOKEN={token_data['refresh_token']}")
            if token_data.get('access_token'):
                print(f"ZOHO_ACCESS_TOKEN={token_data['access_token']}")
            print("-" * 50)
            
            # Also save tokens to config for future reference
            config['ACCESS_TOKEN'] = token_data.get('access_token', '')
            config['REFRESH_TOKEN'] = token_data.get('refresh_token', '')
            save_config(config)
            
            return token_data
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Response: {response.text}")
            
            # Common error messages
            if response.status_code == 400:
                print("\n💡 Common causes:")
                print("   - Grant code already used (codes can only be used once)")
                print("   - Grant code expired (codes expire quickly)")
                print("   - Wrong client credentials")
                print("   - Redirect URI mismatch")
            
            return None
            
    except Exception as e:
        print(f"\n❌ Exception occurred: {str(e)}")
        return None

def main():
    if len(sys.argv) < 2:
        # No grant code provided, show authorization URL
        generate_auth_url()
    elif sys.argv[1] == "--configure":
        # Interactive configuration
        configure_app()
    elif sys.argv[1] == "--help" or sys.argv[1] == "-h":
        print(__doc__)
        print("\nCommands:")
        print("  python generate_zoho_tokens.py              - Show authorization URL")
        print("  python generate_zoho_tokens.py GRANT_CODE   - Exchange code for tokens")
        print("  python generate_zoho_tokens.py --configure  - Interactive setup")
        print("  python generate_zoho_tokens.py --help       - Show this help")
    else:
        # Grant code provided, exchange for tokens
        grant_code = sys.argv[1]
        exchange_code_for_tokens(grant_code)

if __name__ == "__main__":
    main()
