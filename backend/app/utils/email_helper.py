from smtplib import SMTP
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from fastapi import HTTPException
from app.config import SMTP_CONFIG

def send_email(to_email: str, subject: str, body: str,attachments=None):
    try:
        # Initialize SMTP connection
        with SMTP(SMTP_CONFIG["server"], SMTP_CONFIG["port"]) as server:
            if SMTP_CONFIG["tls"]:
                server.starttls()  # Start TLS encryption
            server.login(SMTP_CONFIG["username"], SMTP_CONFIG["password"])

            # Construct email
            msg = MIMEMultipart()
            msg["From"] = "Do Not Reply"
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "html"))
            
            # Attach files if provided
            if attachments:
                for attachment in attachments:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(attachment["content"])
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename={attachment['filename']}",
                    )
                    msg.attach(part)

            # Send email
            server.sendmail(SMTP_CONFIG["from_email"], to_email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")