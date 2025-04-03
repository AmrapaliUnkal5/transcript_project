from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from app.models import TokenPayload 
from app.config import GOOGLE_CLIENT_ID , SQLALCHEMY_DATABASE_URL
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.database import get_db
from app.utils.create_access_token import create_access_token
from .models import Base, User, UserAuthProvider, UserSubscription
from datetime import datetime, timedelta, timezone
import time


router = APIRouter()

# Route to handle Google Sign-In token
@router.post("/auth/google")
async def google_auth(payload: TokenPayload, db: Session = Depends(get_db)):

    try:
        print("hi")
        # Log the incoming payload
        print(f"Received payload: {payload}")
        
        # Validate the token using Google's library
        token_info = id_token.verify_oauth2_token(
            payload.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        print(token_info)

        # Extract user details from token
        google_user_id = token_info["sub"]
        email = token_info["email"]
        name = token_info.get("name", "")
        avatar_url = token_info.get("picture", "")

        # Check if the user already exists in auth providers
        auth_provider = db.query(UserAuthProvider).filter_by(
            provider_user_id=google_user_id,
            provider_name="google"
        ).first()

        

        if auth_provider:
            # Update token details
            auth_provider.access_token = payload.credential
            # Check if it's the first time logging in
            
            auth_provider.token_expiry = datetime.utcnow() + timedelta(seconds=token_info.get("exp", 3600))
            db.commit()
            user = db.query(User).filter_by(user_id=auth_provider.user_id).first()
        else:
            # Check if user exists in users table
            user = db.query(User).filter_by(email=email).first()

            if not user:
                # Create new user entry
                user = User(email=email, name=name, avatar_url=avatar_url)
                db.add(user)
                db.commit()
                db.refresh(user)

            # Create new auth provider entry
            new_auth_provider = UserAuthProvider(
                user_id=user.user_id,
                provider_name="google",
                provider_user_id=google_user_id,
                access_token=payload.credential,
                refresh_token=payload.credential,
                token_expiry = datetime.fromtimestamp(token_info.get("exp", time.time() + 3600), tz=timezone.utc),
                created_at=datetime.utcnow().replace(tzinfo=timezone.utc) 
            )
            db.add(new_auth_provider)
            db.commit()

        user_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user.user_id,
            UserSubscription.status == "active"
        ).order_by(UserSubscription.payment_date.desc()).first()
        
        subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1

        # Generate access token
        token_data = {"sub": user.email, 
                      "role":"client",
                       "user_id": user.user_id,
                       "name": user.name,
                       "avatar_url": user.avatar_url,
                        "subscription_plan_id": subscription_plan_id,  # Added this line
                        "total_words_used": user.total_words_used or 0 }
        access_token = create_access_token(data=token_data, expires_delta=timedelta(minutes=45))

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "email": user.email,
                "name": user.name,
                "user_id": user.user_id,
                "avatar_url": user.avatar_url,
                "subscription_plan_id": subscription_plan_id,  
                "total_words_used": user.total_words_used or 0
            }
        }

    except ValueError as e:
        # Log the error for debugging purposes
        print(f"Error decoding token: {e}")
        raise HTTPException(status_code=400, detail="Invalid token")
