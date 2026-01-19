from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, desc
from app.database import get_db
from app.utils.create_access_token import create_access_token
from .models import Base, User, UserAuthProvider, TeamMember, Notification
from app.schemas import UserOut, UserUpdate, ChangePasswordRequest
from app.dependency import get_current_user
from app.utils.verify_password import verify_password
from passlib.context import CryptContext
from datetime import datetime, timezone
from app.notifications import add_notification
from datetime import datetime, timedelta, timezone
from fastapi.responses import JSONResponse
# Bot-related vector DB functions removed - transcript project doesn't use bots
from typing import List

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/user/me")
def get_user_me(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Fetch user details from the database using user_id
    if current_user["is_team_member"] == True:
        print("logged in as team member")
        logged_in_id = current_user["member_id"]
    else:
        logged_in_id = current_user["user_id"]
        print("logged_in_id",logged_in_id)
        
    user = db.query(User).filter(User.user_id == logged_in_id).first()
    

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's authentication providers
    auth_providers = []
    user_auth_providers = db.query(UserAuthProvider).filter(UserAuthProvider.user_id == logged_in_id).all()
    
    if user_auth_providers:
        auth_providers = [provider.provider_name for provider in user_auth_providers]

    # Construct the response with additional fields
    return {
        "user_id": user.user_id,
        "name": user.name,  # Ensure `name` is included
        "email": user.email,
        "role": user.role,
        "phone_no": user.phone_no,
        "company_name": user.company_name,  #  Ensure this is included
        "communication_email": user.communication_email,  # Ensure this is included
        "auth_providers": auth_providers,
        "avatar_url": user.avatar_url, 
    }

@router.put("/user/me", response_model=UserOut)
def update_user_me(
    user_update: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)  # `current_user` is a dictionary
):
    if current_user["is_team_member"] == True:
        print("logged in as team member")
        logged_in_id = current_user["member_id"]
    else:
        logged_in_id = current_user["user_id"]
        print("logged_in_id",logged_in_id)
    user = db.query(User).filter(User.user_id == logged_in_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")


    # Update only provided fields
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.post("/user/change-password")
def change_password(
    data: ChangePasswordRequest,  # ✅ Matches frontend
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["is_team_member"] == True:
        print("logged in as team member")
        logged_in_id = current_user["member_id"]
    else:
        logged_in_id = current_user["user_id"]
        print("logged_in_id",logged_in_id)
    
    
    # Get the user from DB using user_id from JWT payload
    db_user = db.query(User).filter(User.user_id == logged_in_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    # Verify current password
    if not verify_password(data.current_password, db_user.password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )
   
    # Hash and update new password
    hashed_new_password = pwd_context.hash(data.new_password)
    db_user.password = hashed_new_password
    db.add(db_user)
    db.commit()
    event_type = "PASSWORD_CHANGED"
    if current_user["is_team_member"] == True:
        logged_in_id = current_user["member_id"]
        event_data = f"Team Member{logged_in_id} password was updated on {datetime.now(timezone.utc).strftime('%d %b %Y at %H:%M UTC')}."
        
    else:
        logged_in_id = current_user["user_id"]
        event_data = f"Your password was updated on {datetime.now(timezone.utc).strftime('%d %b %Y at %H:%M UTC')}."
    
    add_notification(
        
        db=db,
        event_type=event_type,
        event_data=event_data,
        bot_id=None,
        user_id=current_user["user_id"]
        
)

    return {"message": "Password updated successfully"}


@router.delete("/user/delete-account")
def delete_user_account(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Permanently deletes a user account and all associated data.
    This includes bots, files, interactions, chat messages, YouTube videos, 
    scraped content, team memberships, etc.
    """
    # Get the current user
    if current_user["is_team_member"] == True:
        raise HTTPException(
            status_code=403, 
            detail="Team members cannot delete their accounts. Please contact the team owner."
        )
    
    user_id = current_user["user_id"]
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Bot-related deletion removed - transcript project doesn't use bots
        
        # Step 1: Delete team-related data
        # Remove user from teams (as owner or member)
        db.query(TeamMember).filter(
            (TeamMember.owner_id == user_id) | (TeamMember.member_id == user_id)
        ).delete(synchronize_session=False)
        
        # Step 3: Delete notifications
        db.query(Notification).filter(
            Notification.user_id == user_id
        ).delete(synchronize_session=False)
        
        # Step 4: Delete auth providers
        db.query(UserAuthProvider).filter(
            UserAuthProvider.user_id == user_id
        ).delete(synchronize_session=False)
        
        # Step 5: Delete the user
        db.delete(user)
        db.commit()
        
        return JSONResponse(
            status_code=200, 
            content={"message": "Account and all associated data have been permanently deleted"}
        )
    
    except Exception as e:
        db.rollback()
        print(f"Error deleting user account: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to delete account: {str(e)}"
        )

# Leads endpoint removed - transcript project doesn't use bots or leads
