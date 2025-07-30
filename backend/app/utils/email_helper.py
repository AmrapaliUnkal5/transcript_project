import sendgrid
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from fastapi import HTTPException
from app.config import SMTP_CONFIG
import base64

def send_email(to_email: str, subject: str, body: str, attachments=None):
    try:
        # Initialize SendGrid client
        sg = sendgrid.SendGridAPIClient(api_key=SMTP_CONFIG["password"])
        
        # Create email message with "Do Not Reply" display name
        message = Mail(
            from_email=(SMTP_CONFIG["from_email"], "Do Not Reply"),
            to_emails=to_email,
            subject=subject,
            html_content=body
        )
        
        # Add attachments if provided
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
        
        # Send email
        response = sg.send(message)
        return response.status_code
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")