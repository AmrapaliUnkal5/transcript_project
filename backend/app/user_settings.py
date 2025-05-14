from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.database import get_db
from app.utils.create_access_token import create_access_token
from .models import Base, User, UserAuthProvider,SubscriptionPlan,UserSubscription
from app.schemas import UserOut,UserUpdate, ChangePasswordRequest
from app.dependency import get_current_user
from app.utils.verify_password import verify_password
from passlib.context import CryptContext
from datetime import datetime, timezone
from app.notifications import add_notification
from datetime import datetime, timedelta, timezone

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
    
    # Fetch current active subscription (assuming latest/active is needed)
    subscription = (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == current_user["user_id"],
            UserSubscription.status == "active"
        )
        .order_by(UserSubscription.payment_date.desc())
        .first()
    )

    #print("subscription.subscription_plan_id",subscription.subscription_plan_id)

    subscription_data = None
    if subscription:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.subscription_plan_id).first()
        print("plan.name",plan.name)
        subscription_data = {
            "plan_name": plan.name if plan else "Unknown Plan",
            "amount": float(subscription.amount),
            "currency": subscription.currency,
            "payment_date": subscription.payment_date,
            "expiry_date": subscription.expiry_date,
            "auto_renew": subscription.auto_renew,
            "status": subscription.status
        }
    else:
    # No subscription record, default to Explorer Plan
        subscription_data = {
            "plan_name": "Explorer Plan",
            "amount": "N/A",
            "currency": "",
            "payment_date": "",
            "expiry_date": "",
            "auto_renew": "",
            "status": "Active"
        }
    
  

    # Construct the response with additional fields
    return {
        "user_id": user.user_id,
        "name": user.name,  # Ensure `name` is included
        "email": user.email,
        "role": user.role,
        "phone_no":user.phone_no,
        "company_name": user.company_name,  #  Ensure this is included
        "communication_email": user.communication_email,  # Ensure this is included
        "subscription": subscription_data
        
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


@router.get("/check-user-subscription/{user_id}")
def check_user_subscription(user_id: int, db: Session = Depends(get_db)):
    subscription = (
        db.query(UserSubscription)
        .filter_by(user_id=user_id, subscription_plan_id=1)
        .first()
    )
    return {"exists": bool(subscription)}
