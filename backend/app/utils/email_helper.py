from fastapi import HTTPException
from app.config import SMTP_CONFIG
from email.utils import formataddr
import base64

if SMTP_CONFIG["PROFILE"] == 'dev':
    # Use SendGrid implementation
    import sendgrid
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    
    def send_email(to_email: str, subject: str, body: str, attachments=None):
        try:
            sg = sendgrid.SendGridAPIClient(api_key=SMTP_CONFIG["password"])
            message = Mail(
                from_email=(SMTP_CONFIG["from_email"], "Do Not Reply"),
                to_emails=to_email,
                subject=subject,
                html_content=body
            )
            
            if attachments:
                for attachment in attachments:
                    encoded_file = base64.b64encode(attachment["content"]).decode()
                    attached_file = Attachment(
                        FileContent(encoded_file),
                        FileName(attachment['filename']),
                        FileType(attachment.get('type', 'application/octet-stream')),
                        Disposition('attachment')
                    )
                    message.attachment = attached_file
            
            response = sg.send(message)
            return response.status_code
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
else:
    # Use SMTP implementation
    from smtplib import SMTP
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    
    def send_email(to_email: str, subject: str, body: str, attachments=None):
        try:
            with SMTP(SMTP_CONFIG["server"], SMTP_CONFIG["port"]) as server:
                if SMTP_CONFIG["tls"]:
                    server.starttls()
                server.login(SMTP_CONFIG["username"], SMTP_CONFIG["password"])

                msg = MIMEMultipart()
                msg["From"] = "Do Not Reply"
                msg["To"] = to_email
                msg["Subject"] = subject
                msg.attach(MIMEText(body, "html"))
                
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

                server.sendmail(SMTP_CONFIG["from_email"], to_email, msg.as_string())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
