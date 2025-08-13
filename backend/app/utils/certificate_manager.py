import os
import logging
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtensionOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from typing import Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class CertificateManager:
    """Manages X.509 certificates for SAML SSO authentication"""
    
    def __init__(self, cert_dir: str = "certificates"):
        """Initialize certificate manager with directory path"""
        self.cert_dir = Path(cert_dir)
        self.cert_dir.mkdir(exist_ok=True)
        self.private_key_file = self.cert_dir / "saml_private_key.pem"
        self.public_cert_file = self.cert_dir / "saml_public_cert.pem"
        
    def generate_certificate_pair(self, 
                                 subject_name: str = "Evolra SSO", 
                                 organization: str = "Evolra",
                                 country: str = "US",
                                 validity_days: int = 365) -> Tuple[str, str]:
        """
        Generate a new RSA private key and self-signed certificate pair
        
        Returns:
            Tuple of (private_key_pem, public_cert_pem)
        """
        try:
            logger.info("Generating new certificate pair for SAML SSO")
            
            # Generate private key
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            
            # Create certificate subject
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, country),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
                x509.NameAttribute(NameOID.COMMON_NAME, subject_name),
            ])
            
            # Create certificate
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.utcnow()
            ).not_valid_after(
                datetime.utcnow() + timedelta(days=validity_days)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.DNSName("*.evolra.ai"),
                ]),
                critical=False,
            ).sign(private_key, hashes.SHA256())
            
            # Serialize private key
            private_key_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode('utf-8')
            
            # Serialize certificate
            public_cert_pem = cert.public_bytes(
                serialization.Encoding.PEM
            ).decode('utf-8')
            
            # Save to files
            self._save_private_key(private_key_pem)
            self._save_public_cert(public_cert_pem)
            
            logger.info("Certificate pair generated and saved successfully")
            return private_key_pem, public_cert_pem
            
        except Exception as e:
            logger.error(f"Error generating certificate pair: {str(e)}")
            raise
    
    def _save_private_key(self, private_key_pem: str) -> None:
        """Save private key to file with secure permissions"""
        with open(self.private_key_file, 'w') as f:
            f.write(private_key_pem)
        # Set restrictive permissions (owner read/write only)
        os.chmod(self.private_key_file, 0o600)
        
    def _save_public_cert(self, public_cert_pem: str) -> None:
        """Save public certificate to file"""
        with open(self.public_cert_file, 'w') as f:
            f.write(public_cert_pem)
        # Set read permissions for owner and group
        os.chmod(self.public_cert_file, 0o644)
    
    def load_certificate_pair(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Load existing certificate pair from files
        
        Returns:
            Tuple of (private_key_pem, public_cert_pem) or (None, None) if not found
        """
        try:
            if not (self.private_key_file.exists() and self.public_cert_file.exists()):
                logger.warning("Certificate files not found")
                return None, None
                
            with open(self.private_key_file, 'r') as f:
                private_key_pem = f.read()
                
            with open(self.public_cert_file, 'r') as f:
                public_cert_pem = f.read()
                
            logger.info("Certificate pair loaded successfully")
            return private_key_pem, public_cert_pem
            
        except Exception as e:
            logger.error(f"Error loading certificate pair: {str(e)}")
            return None, None
    
    def get_or_create_certificate_pair(self) -> Tuple[str, str]:
        """
        Get existing certificate pair or create new one if not exists
        
        Returns:
            Tuple of (private_key_pem, public_cert_pem)
        """
        private_key, public_cert = self.load_certificate_pair()
        
        if private_key and public_cert:
            # Check if certificate is still valid
            if self._is_certificate_valid(public_cert):
                return private_key, public_cert
            else:
                logger.info("Certificate expired, generating new pair")
        
        # Generate new certificate pair
        return self.generate_certificate_pair()
    
    def _is_certificate_valid(self, cert_pem: str) -> bool:
        """Check if certificate is still valid (not expired)"""
        try:
            cert = x509.load_pem_x509_certificate(cert_pem.encode('utf-8'))
            return datetime.utcnow() < cert.not_valid_after
        except Exception as e:
            logger.error(f"Error checking certificate validity: {str(e)}")
            return False
    
    def get_public_cert_for_zoho(self) -> str:
        """
        Get the public certificate in the format required by Zoho Billing
        (PEM format without headers/footers)
        """
        _, public_cert = self.get_or_create_certificate_pair()
        
        # Remove PEM headers and footers for Zoho
        cert_content = public_cert.replace('-----BEGIN CERTIFICATE-----\n', '')
        cert_content = cert_content.replace('\n-----END CERTIFICATE-----\n', '')
        cert_content = cert_content.replace('\n', '')
        
        return cert_content 