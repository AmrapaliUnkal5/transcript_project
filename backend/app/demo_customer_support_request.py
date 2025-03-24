from fastapi import FastAPI, HTTPException, APIRouter, BackgroundTasks, UploadFile, File, Form
from app.utils.email_helper import send_email
from app.config import SMTP_CONFIG
from typing import Optional, List
from app.schemas import DemoRequest

router = APIRouter()

def send_email_notification(demo_request: DemoRequest, attachments: List[dict] = None):
    """Function to send email in the background based on request type."""
    try:
        print("Data Received=>",demo_request)
        if demo_request.requestType == "demo":
            # Draft email for demo request
            email_body = f"""
New Demo Request Received:

Name: {demo_request.name}
Email: {demo_request.email}
Country: {demo_request.country}
Company: {demo_request.company or "Not provided"}
Phone: {demo_request.phone or "Not provided"}
"""

            subject = "New Demo Request"
        elif demo_request.requestType == "support":
            # Draft email for customer support request
            email_body = f"""
New Customer Support Request Received:

Name: {demo_request.name}
Email: {demo_request.email}
Country: {demo_request.country}
Company: {demo_request.company or "Not provided"}
Phone: {demo_request.phone or "Not provided"}
Description: {demo_request.description or "Not provided"}
"""

            subject = "New Customer Support Request"
        else:
            raise ValueError("Invalid request type. Must be 'demo' or 'support'.")

        # Send the email with attachments (if any)
        send_email(
            to_email=SMTP_CONFIG["demo_email"],
            subject=subject,
            body=email_body,
            attachments=attachments  
        )

    except Exception as e:
        print(f"Failed to send email: {str(e)}") 
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@router.post("/submit-demo-request")
async def submit_demo_request(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    email: str = Form(...),
    country: str = Form(...),
    company: str = Form(None),
    phone: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    requestType: str = Form(...),  
    files: Optional[List[UploadFile]] = File(None),  
):
    try:
        #print("Received request data:")  
        #print(f"Name: {name}, Email: {email}, Country: {country}, Company: {company}, Phone: {phone}, Description: {description}, RequestType: {requestType}")  # Debugging

        # Validate request type
        if requestType not in ["demo", "support"]:
            raise HTTPException(status_code=400, detail="Invalid request type. Must be 'demo' or 'support'.")

        # Create the request object
        demo_request = DemoRequest(
            name=name,
            email=email,
            country=country,
            company=company,
            phone=phone,
            description=description if requestType == "support" else None,
            requestType=requestType,
        )

        # Only process files if requestType is "support"
        attachments = []
        if requestType == "support" and files:
            for file in files:
                attachment = {
                    "filename": file.filename,
                    "content": await file.read(),  
                }
                attachments.append(attachment)

        # Add email task to background
        background_tasks.add_task(send_email_notification, demo_request, attachments)
        #print("Email task added to background tasks.")  

        return {"message": f"{requestType.capitalize()} request submitted successfully. We will contact you shortly."}

    except Exception as error:
        #print(f"Error: {str(error)}")  
        raise HTTPException(status_code=500, detail=f"Error: {str(error)}")
