from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import User, UserSubscription, SubscriptionPlan
from app.database import get_db
from app.utils.create_access_token import decode_access_token, create_access_token
from app.config import settings
from datetime import datetime, timedelta
from app.utils.email_helper import send_email
from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify the user's email from the token sent via email.
    """
    try:
        payload = decode_access_token(token)  # Decode the token
        email = payload.get("sub")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token")

        # Fetch the user from the database
        user = db.query(User).filter(User.email == email).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")
       
        if user.is_verified:
            return {"message": "Email already verified. You can log in."}

        # Mark user as verified
        
         # Get the free plan (Explorer Plan) from subscription_plans
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Explorer Plan").first()

        if not free_plan:
            raise HTTPException(status_code=404, detail="Free plan not found")   

        # Insert user into user_subscriptions with the free plan
        subscription = UserSubscription(
            user_id=user.user_id,
            subscription_plan_id=free_plan.id,
            amount=0.00,
            currency="USD",
            payment_date=datetime.now(timezone.utc),
            expiry_date=datetime.now(timezone.utc) + timedelta(days=30),
            status="active",
            auto_renew=False
        )

        db.add(subscription)
        db.commit()

        user.is_verified = True
        db.commit() 

        return {"message": "Email verified successfully. You can now log in."}

    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

# Define Pydantic model for request body
class TokenRequest(BaseModel):
    token: str

@router.post("/resend-verification-email")
def resend_verification_email(request: TokenRequest, db: Session = Depends(get_db)):
    """
    Resend the verification email using the expired token.
    """
    try:
        
        token = request.token
        print("Received token:", token)  # Debugging line
        print("dsd")
        # Decode the expired token to extract the email
        # Attempt to decode the token
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM] ,options={"verify_exp": False} )
        except JWTError as e:
            print("JWT Decode Error:", str(e))  # Debugging log
            raise HTTPException(status_code=400, detail="Invalid or expired token")

        email = payload.get("sub")
        print("Extracted email:", email)  # Debugging line

        if not email:
            raise HTTPException(status_code=400, detail="Invalid token")

        # Fetch the user from the database
        user = db.query(User).filter(User.email == email).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        print("user",user)

        if user.is_verified:
            return {"message": "Email already verified. You can log in."}

        # Generate a new verification token (valid for 24 hours)
        new_token = create_access_token({"sub": user.email}, expires_delta=timedelta(hours=settings.REGISTER_TOKEN_EXPIRE_HOURS))

        # Send the new verification email
        verification_link = f"{settings.BASE_URL}/verify-email?token={new_token}"
        body = f"""
        
        Please verify your email by clicking the link below:

        {verification_link}

        This link will expire in 24 hours.

        Best regards,
        Your Team
        """
         
        subject = "Verify Your Email - Complete Registration"
        send_email(user.email, subject, body)
        

        return {"message": "A new verification email has been sent."}

    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
