from fastapi import FastAPI, HTTPException, APIRouter, BackgroundTasks, UploadFile, File, Form
from app.utils.email_helper import send_email
from app.config import SMTP_CONFIG
from typing import Optional, List
from app.schemas import DemoRequest

router = APIRouter()

def send_email_notification(demo_request: DemoRequest, attachments: List[dict] = None):
    """Function to send email in the background based on request type."""
    try:
        print("Data Received=>", demo_request)
        if demo_request.requestType == "demo":
            # Draft internal email
            email_body = f"""
New Demo Request Received:

Name: {demo_request.name}
Email: {demo_request.email}
Country: {demo_request.country}
Company: {demo_request.company or "Not provided"}
Phone: {demo_request.phone or "Not provided"}
"""
            subject = "New Demo Request"
            confirmation_subject = "Thank You for Requesting a Demo"
            confirmation_body = f"""
Dear {demo_request.name},

Thank you for requesting a demo. Our team will reach out to you shortly.

Best regards,
[Your Company Name]
"""

        elif demo_request.requestType == "support":
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
            confirmation_subject = "We Received Your Support Request"
            confirmation_body = f"""
Dear {demo_request.name},

Thank you for reaching out to customer support. We have received your query and will get back to you shortly.

Best regards,
[Your Company Name]
"""

        else:
            raise ValueError("Invalid request type. Must be 'demo' or 'support'.")

        # 1st email to internal team
        send_email(
            to_email=SMTP_CONFIG["demo_email"],
            subject=subject,
            body=email_body,
            attachments=attachments
        )

        # 2nd email to user (confirmation)
        send_email(
            to_email=demo_request.email,
            subject=confirmation_subject,
            body=confirmation_body
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