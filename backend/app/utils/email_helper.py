from smtplib import SMTP
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import HTTPException
from app.config import SMTP_CONFIG

def send_email(to_email: str, subject: str, body: str):
    try:
        # Initialize SMTP connection
        with SMTP(SMTP_CONFIG["server"], SMTP_CONFIG["port"]) as server:
            if SMTP_CONFIG["tls"]:
                server.starttls()  # Start TLS encryption
            server.login(SMTP_CONFIG["username"], SMTP_CONFIG["password"])  # Login

            # Construct email
            msg = MIMEMultipart()
            msg["From"] = SMTP_CONFIG["from_email"]
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            # Send email
            server.sendmail(SMTP_CONFIG["from_email"], to_email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
