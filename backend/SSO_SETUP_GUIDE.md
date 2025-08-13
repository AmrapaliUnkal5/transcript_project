# SAML SSO Setup Guide for Zoho Billing

This guide will help you set up Single Sign-On (SSO) between your application and Zoho Billing using SAML.

## Overview

Your application now acts as an Identity Provider (IdP) for Zoho Billing. When users click "Manage Subscription", they'll be automatically logged into Zoho Billing without needing separate credentials.

## Prerequisites

- ✅ SAML certificates generated (see output above)
- ✅ Backend server running
- ✅ Zoho Billing account with SSO capability

## Step 1: Configure Zoho Billing SSO

1. **Log into your Zoho Billing account**
2. **Navigate to Settings → Customer Portal → General**
3. **Click "Configure" next to "Portal SSO (Single Sign-On)"**
4. **Fill in the following details:**

### Required Fields:

| Field | Value |
|-------|-------|
| **Login URL** | `https://yourdomain.com/auth/saml/login` |
| **Logout URL** | `https://yourdomain.com/auth/saml/logout` |
| **Password Reset URL** | `https://yourdomain.com/reset-password` |
| **Public Key** | Copy the certificate content from the script output above |

### Certificate Content (Copy this exactly):
```
MIIDGTCCAgGgAwIBAgIUSfhouCAyadz1ehoTOug+CpnW3mMwDQYJKoZIhvcNAQELBQAwMzELMAkGA1UEBhMCVVMxDzANBgNVBAoMBkV2b2xyYTETMBEGA1UEAwwKRXZvbHJhIFNTTzAeFw0yNTA3MjkwNTUwNTJaFw0yNjA3MjkwNTUwNTJaMDMxCzAJBgNVBAYTAlVTMQ8wDQYDVQQKDAZFdm9scmExEzARBgNVBAMMCkV2b2xyYSBTU08wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCw1hVDj6nHKiMWibGP+ZQIRR8uXkxhUdzty2+u8QC9v9aNrqGi1r0H02wR3P5BKd8L0vWCRDUH2SyQmwWlBA0ZjwRMynXvLS7U+u6Hk1w+E5A90t+XyBzCH6R9vmq9XhStW8hUMoVEbc4Cv9sHL6hwfDKlWEyDXAk00BSjatw05rvyo9oZRKDgo/uTW+gOk9smk82UBey5sc7j1Zo2cgGz/ZTTY2egivystteFvxPFsLV7an4LHQnTrvEjQyi7cp7e247kWxs7EeW00qS000XLRoIELLNqeVeR+FjWlbwIqNF5UUjVByxOiVZEJtwIZXrDHq3pY9XI1vEMKYr+0ZgRAgMBAAGjJTAjMCEGA1UdEQQaMBiCCWxvY2FsaG9zdIILKi5ldm9scmEuYWkwDQYJKoZIhvcNAQELBQADggEBAIJKVe0KTzGSf7zUF3HM3BxoExgoW2gfF0W+ArF8RRHhDF1dpkIUoXv2UZgS+tPWQWs85ms7pBx1qAYZNb86dyNY45MoPZceq/K6G6uDBS0/d8/l+T+XiBKe4bMmHj1GZiO4L2SLqMcPpQ+Io3psaC2SbWEGaJmC/zMcF1qaTftIwmMukAGwNJwr34Cf6yp7Otyy4rD+kqvCsF/rRpAXfzz/hHLlwohjFCKh2zrVYVYTiyIg4y1gia0BOo5ahlHaLfrVGiLNBXgrXBoVUaf7BoP0woQk+mPjVuABmhvdFo3d9O3yyUsKk0O0orPXVjk8pIEEyAg/YkU7tclv/kcHfF0=
```

5. **Click "Configure Now"**
6. **Copy the ACS URL and Relay State values displayed**

## Step 2: Configure Environment Variables

Add these variables to your `.env` file:

```bash
# SAML SSO Configuration for Zoho Billing
SAML_ISSUER=https://yourdomain.com
ZOHO_SAML_ACS_URL=https://subscriptions.zoho.com/portal/your-org/saml/acs
ZOHO_SAML_RELAY_STATE=your-relay-state-from-zoho
```

**Replace the values with the actual ACS URL and Relay State from Zoho.**

## Step 3: Test the Implementation

1. **Start your backend server:**
   ```bash
   cd backend
   source newenv/bin/activate
   python -m uvicorn app.main:app --reload
   ```

2. **Test the SSO flow:**
   - Log into your application
   - Navigate to the subscription page
   - Click "Manage Subscription"
   - You should be automatically logged into Zoho Billing

## Step 4: Troubleshooting

### Common Issues:

1. **Certificate Issues:**
   - Regenerate certificates: `python generate_certificates.py`
   - Ensure certificate is copied exactly (no extra spaces)

2. **URL Issues:**
   - Verify your domain is accessible
   - Check that `/auth/saml/login` endpoint is working
   - Test with: `curl https://yourdomain.com/auth/saml/metadata`

3. **Environment Variables:**
   - Ensure all SAML variables are set correctly
   - Restart the server after changing environment variables

### Debug Endpoints:

- **Metadata:** `GET /auth/saml/metadata`
- **Certificate:** `GET /auth/saml/certificate`
- **Login:** `GET /auth/saml/login`

## Security Notes

- ✅ Certificates are stored securely with proper permissions
- ✅ Private key is encrypted and protected
- ✅ SAML assertions are signed and time-limited
- ✅ HTTPS is required for production use

## Production Deployment

For production, ensure:

1. **HTTPS is enabled** on your domain
2. **Update the SAML_ISSUER** to your production domain
3. **Update Zoho configuration** with production URLs
4. **Monitor logs** for any SSO-related errors

## Support

If you encounter issues:

1. Check the application logs for SAML-related errors
2. Verify Zoho configuration matches exactly
3. Test the metadata endpoint is accessible
4. Ensure all environment variables are set correctly

---

**Success!** Your users can now seamlessly access Zoho Billing without separate login credentials. 