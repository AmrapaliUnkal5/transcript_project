from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from app.models import TokenPayload 
from app.config import GOOGLE_CLIENT_ID , SQLALCHEMY_DATABASE_URL,FACEBOOK_APP_SECRET,settings
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.database import get_db
from app.utils.create_access_token import create_access_token
from .models import Base, User, UserAddon, UserAuthProvider, UserSubscription, TeamMember
from datetime import datetime, timedelta, timezone
import time
from app.utils.logger import get_module_logger
import requests as python_requests
from fastapi.responses import JSONResponse
import json
import hashlib
import hmac
import base64
from pydantic import BaseModel

# Initialize logger
logger = get_module_logger(__name__)

router = APIRouter()

ACCESS_TOKEN_EXPIRE_MINUTES = 120

# Route to handle Google Sign-In token
@router.post("/auth/google")
async def google_auth(request: Request, payload: TokenPayload, db: Session = Depends(get_db)):
    # Get request_id from request state (added by LoggingMiddleware)
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        logger.info("Processing Google authentication request", 
                   extra={"request_id": request_id})
        
        # Validate the token using Google's library
        logger.debug("Validating Google token", 
                    extra={"request_id": request_id})
        
        token_info = id_token.verify_oauth2_token(
            payload.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Extract user details from token
        google_user_id = token_info["sub"]
        email = token_info["email"]
        name = token_info.get("name", "")
        avatar_url = token_info.get("picture", "")
        
        logger.info(f"Google authentication successful for email: {email}", 
                   extra={"request_id": request_id, "google_user_id": google_user_id})

        # Check if the user already exists in auth providers
        auth_provider = db.query(UserAuthProvider).filter_by(
            provider_user_id=google_user_id,
            provider_name="google"
        ).first()

        if auth_provider:
            logger.debug(f"Found existing Google auth provider for user", 
                        extra={"request_id": request_id, "user_id": auth_provider.user_id})
            
            # Update token details
            auth_provider.access_token = payload.credential
            # Check if it's the first time logging in
            
            auth_provider.token_expiry = datetime.utcnow() + timedelta(seconds=token_info.get("exp", 3600))
            db.commit()
            user = db.query(User).filter_by(user_id=auth_provider.user_id).first()
            logger.info(f"Updated Google auth provider token for user", 
                       extra={"request_id": request_id, "user_id": user.user_id})
        else:
            # Check if user exists in users table
            user = db.query(User).filter_by(email=email).first()

            if not user:
                logger.info(f"Creating new user for Google authentication", 
                           extra={"request_id": request_id, "email": email})
                           
                # Create new user entry
                user = User(email=email, name=name, avatar_url=avatar_url)
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"New user created", 
                           extra={"request_id": request_id, "user_id": user.user_id})

            # Create new auth provider entry
            logger.debug(f"Creating new Google auth provider for user", 
                        extra={"request_id": request_id, "user_id": user.user_id})
                        
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
            logger.info(f"New Google auth provider created", 
                       extra={"request_id": request_id, "user_id": user.user_id})

        user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user.user_id,
        UserSubscription.status.notin_(["pending", "failed", "cancelled"])
        ).order_by(UserSubscription.payment_date.desc()).first()

        # Get message addon (ID 5) details if exists
        message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == user.user_id,
        UserAddon.addon_id == 5,
        UserAddon.is_active == True
        ).order_by(UserAddon.expiry_date.desc()).first()
        
        subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1
        
        logger.debug(f"User subscription plan", 
                    extra={"request_id": request_id, "user_id": user.user_id, 
                           "subscription_plan_id": subscription_plan_id})

        # Fetch user's active addons
        user_addons = db.query(UserAddon).filter(
            UserAddon.user_id == user.user_id,
            UserAddon.status == "active"  # Assuming you have a status field
            ).all()
    
        addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []

        # Generate access token
        token_data = {"sub": user.email, 
                      "role":"client",
                       "user_id": user.user_id,
                       "name": user.name,
                       "avatar_url": user.avatar_url,
                        "subscription_plan_id": subscription_plan_id,
                        "addon_plan_ids": addon_plan_ids,  # Added this line
                        "total_words_used": user.total_words_used or 0,
                        "subscription_status": user_subscription.status if user_subscription else "new",
                        "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',}
        access_token = create_access_token(data=token_data, expires_delta=timedelta(minutes=45))
        
        logger.info(f"User authenticated successfully with Google", 
                   extra={"request_id": request_id, "user_id": user.user_id, "email": email})

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
        logger.error(f"Invalid Google token: {str(e)}", 
                    extra={"request_id": request_id})
        raise HTTPException(status_code=400, detail="Invalid token")
    except Exception as e:
        logger.exception(f"Error during Google authentication: {str(e)}", 
                        extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail="Authentication failed")
    

#Added for facebook login

class FacebookLoginRequest(BaseModel):
    access_token: str

@router.post("/auth/facebook")
async def facebook_login(
    request: FacebookLoginRequest,
    db: Session = Depends(get_db)
):
    access_token = request.access_token
    print("access_token",access_token)
    try:
        # Step 1: Validate Facebook token
        user_info = python_requests.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,name,email,picture",
                "access_token": access_token
            }
        ).json()

        if "error" in user_info:
            raise HTTPException(status_code=400, detail="Invalid Facebook token")

        # Extract user details
        facebook_user_id = user_info["id"]
        email = user_info.get("email")
        name = user_info["name"]
        avatar_url = (user_info.get("picture", {}).get("data", {}).get("url", "")
                      if user_info.get("picture") else "")
        print("facebook_user_id",facebook_user_id)
        print("email",email)
        print("name",name)
        print("avatar_url",avatar_url)

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided")

        # Step 2: Check auth provider
        auth_provider = db.query(UserAuthProvider).filter_by(
            provider_user_id=facebook_user_id,
            provider_name="facebook"
        ).first()

        if auth_provider:
            # Update token
            auth_provider.access_token = access_token
            auth_provider.token_expiry = datetime.utcnow() + timedelta(seconds=3600)
            db.commit()
            user = db.query(User).filter_by(user_id=auth_provider.user_id).first()
            if user:
                user.avatar_url = avatar_url
                db.commit()
        else:
            # Create or fetch user
            user = db.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    email=email,
                    name=name,
                    avatar_url=avatar_url,
                    is_verified=True  # Facebook users assumed verified
                )
                db.add(user)
                db.commit()
                db.refresh(user)

            new_provider = UserAuthProvider(
                user_id=user.user_id,
                provider_name="facebook",
                provider_user_id=facebook_user_id,
                access_token=access_token,
                refresh_token=access_token,
                token_expiry=datetime.utcnow() + timedelta(seconds=3600),
                created_at=datetime.utcnow()
            )
            db.add(new_provider)
            db.commit()

        # Team member check
        team_member_entry = db.query(TeamMember).filter(
            TeamMember.member_id == user.user_id,
            TeamMember.invitation_status == "accepted"
        ).first()
        is_team_member = team_member_entry is not None
        owner_id = team_member_entry.owner_id if is_team_member else None

        subscription_user_id = owner_id if is_team_member else user.user_id
        member_id = user.user_id if is_team_member else None

        # Subscription
        user_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == subscription_user_id,
            UserSubscription.status.notin_(["pending", "failed", "cancelled"])
        ).order_by(UserSubscription.payment_date.desc()).first()

        subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1

        # Addons
        message_addon = db.query(UserAddon).filter(
            UserAddon.user_id == subscription_user_id,
            UserAddon.addon_id == 5,
            UserAddon.is_active == True
        ).order_by(UserAddon.expiry_date.desc()).first()

        user_addons = db.query(UserAddon).filter(
            UserAddon.user_id == subscription_user_id,
            UserAddon.status == "active"
        ).all()

        addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []

    # JWT Token
        token_data = {
            "sub": user.email,
            "role": user.role,
            "user_id": subscription_user_id,
            "name": user.name,
            "company_name": user.company_name,
            "phone_no": user.phone_no,
            "subscription_plan_id": subscription_plan_id,
            "total_words_used": user.total_words_used,
            "is_team_member": is_team_member,
            "member_id": member_id,
            "addon_plan_ids": addon_plan_ids,
            "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
            "subscription_status": user_subscription.status if user_subscription else "new",
            "avatar_url": user.avatar_url,
        }

        jwt_token = create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "company_name": user.company_name,
                "user_id": subscription_user_id,
                "avatar_url": user.avatar_url,
                "phone_no": user.phone_no,
                "subscription_plan_id": subscription_plan_id,
                "total_words_used": user.total_words_used,
                "is_team_member": is_team_member,
                "member_id": member_id,
                "addon_plan_ids": addon_plan_ids,
                "message_addon_expiry": message_addon.expiry_date if message_addon else 'Not Available',
                "subscription_status": user_subscription.status if user_subscription else "new",
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/data-deletion")
async def data_deletion_request(signed_request: str, db: Session = Depends(get_db)):
    try:
        data = parse_signed_request(signed_request)
        provider_user_id = data["user_id"]

        auth_provider_record = db.query(UserAuthProvider).filter(UserAuthProvider.provider_user_id == provider_user_id).first()

        if not auth_provider_record:
            raise HTTPException(status_code=404, detail="User not found in the authentication provider table")

        user_id = auth_provider_record.user_id

        db.query(UserAuthProvider).filter(UserAuthProvider.provider_user_id == provider_user_id).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()

        status_url = f"{settings.BASE_URL}/deletion?id={user_id}"
        confirmation_code = f"del_{user_id}"

        return JSONResponse(
            content={"url": status_url, "confirmation_code": confirmation_code}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing deletion request: {str(e)}")


def parse_signed_request(signed_request: str):
    encoded_sig, payload = signed_request.split('.', 2)
    sig = base64_url_decode(encoded_sig)
    data = json.loads(base64_url_decode(payload))

    expected_sig = hmac.new(
        FACEBOOK_APP_SECRET.encode(), payload.encode(), hashlib.sha256
    ).digest()

    if sig != expected_sig:
        raise ValueError("Invalid signature")

    return data


def base64_url_decode(input: str) -> str:
    return base64.urlsafe_b64decode(input + "==").decode("utf-8")
