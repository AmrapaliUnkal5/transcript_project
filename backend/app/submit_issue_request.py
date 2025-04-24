from fastapi import Form, UploadFile, File, Depends, HTTPException, APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependency import get_current_user
from app.schemas import UserOut
from app.config import SMTP_CONFIG  
from app.utils.email_helper import send_email  
import os
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

router = APIRouter()

MAX_FILE_SIZE = 2 * 1024 * 1024  

def send_issue_email(
    user_id: str,
    user_name: str,
    user_email: str,
    user_company: str,
    user_phone: str,
    issue_type: str,
    description: str,
    attachments: list = None,
):
    """Function to send email in the background."""
    subject = "Issue Request"
    body = f"""
    User ID: {user_id}
    Name: {user_name}
    Email: {user_email}
    Company: {user_company}
    Phone: {user_phone or "Not provided"}
    Issue Type: {issue_type or "Not provided"}
    Description: {description}
    """

    # Send email with optional attachments
    send_email(
        subject=subject,
        body=body,
        to_email=SMTP_CONFIG["demo_email"],
        attachments=attachments,
    )

@router.post("/submit-issue-request")
async def submit_issue_request(
    issue_type: str = Form(...),
    description: str = Form(...),
    files: list[UploadFile] = File(default=None),  # Accept multiple files
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    try:
        print(f"Received description: {description}")
        # Extract user details from current_user
        user_email = current_user["email"]
        user_name = current_user["name"]
        user_company = current_user["company_name"]
        user_phone = current_user["phone_no"]
        user_id = current_user["user_id"]

        print("Extracted Data", user_email, user_id, user_name, user_company, user_phone)

        # Validate file sizes and prepare attachments
        attachments = []
        if files:
            for file in files:
                if file.size > MAX_FILE_SIZE:
                    raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds the 2MB size limit.")
                attachment = {
                    "filename": file.filename,
                    "content": await file.read(),  # Read the file content
                }
                attachments.append(attachment)

        # Add email task to background
        background_tasks.add_task(
            send_issue_email,
            user_id=user_id,
            user_name=user_name,
            user_email=user_email,
            user_company=user_company,
            user_phone=user_phone,
            issue_type=issue_type,
            description=description,
            attachments=attachments,
        )

        return JSONResponse(status_code=200, content={"message": "Issue request submitted successfully."})

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")