from fastapi import FastAPI, HTTPException, APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.utils.email_helper import send_email
from app.schemas import DemoRequest  # Pydantic schema
from app.models import DemoRequest as DemoRequestModel  # SQLAlchemy model
from app.database import get_db
from app.config import SMTP_CONFIG

router = APIRouter()

def send_demo_email(demo_request: DemoRequest):
    """Function to send email in the background."""
    email_body = f"""
    New Demo Request Received:

    Name: {demo_request.name}
    Email: {demo_request.email}
    Country: {demo_request.country}
    Company: {demo_request.company}
    Phone: {demo_request.phone or "Not provided"}
    """

    send_email(
        to_email=SMTP_CONFIG["demo_email"],
        subject="New Demo Request",
        body=email_body
    )

@router.post("/submit-demo-request")
async def submit_demo_request(
    demo_request: DemoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        db_demo_request = DemoRequestModel(
            name=demo_request.name,
            email=demo_request.email,
            country=demo_request.country,
            company=demo_request.company,
            phone=demo_request.phone,
        )
        db.add(db_demo_request)
        db.commit()
        db.refresh(db_demo_request)

        # Add email task to background
        background_tasks.add_task(send_demo_email, demo_request)

        return {"message": "Demo request submitted successfully. We will contact you shortly."}

    except Exception as db_error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
