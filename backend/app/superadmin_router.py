from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .database import get_db
from .dependency import get_current_user
from app.schemas import ImpersonateRequest
from .models import User,TeamMember,UserSubscription,UserAddon, UserAuthProvider
from sqlalchemy import and_, or_
from app.utils.create_access_token import create_access_token
from app.utils.file_storage import resolve_file_url
from app.utils.verify_password import verify_password

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

ACCESS_TOKEN_EXPIRE_MINUTES = 120

@router.post("/impersonate")
def impersonate_user(
    request: ImpersonateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # 1. Check if logged-in user is Superadmin
    if current_user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Not authorized to impersonate users")

    # 2. Get target user
    target_user = db.query(User).filter(User.email == request.customer_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 3. Team member check
    team_member_entry = db.query(TeamMember).filter(
        TeamMember.member_id == target_user.user_id,
        TeamMember.invitation_status == "accepted"
    ).first()
    is_team_member = team_member_entry is not None
    owner_id = team_member_entry.owner_id if is_team_member else None
    subscription_user_id = owner_id if is_team_member else target_user.user_id
    member_id = target_user.user_id if is_team_member else None

    # 4. Subscription info
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == subscription_user_id,
        UserSubscription.status.notin_(["pending", "failed", "cancelled"])
    ).order_by(UserSubscription.payment_date.desc()).first()
    subscription_plan_id = user_subscription.subscription_plan_id if user_subscription else 1

    # 5. Addon info
    user_addons = db.query(UserAddon).filter(
        UserAddon.user_id == subscription_user_id,
        UserAddon.status == "active"
    ).all()
    addon_plan_ids = [addon.addon_id for addon in user_addons] if user_addons else []

    message_addon = db.query(UserAddon).filter(
        UserAddon.user_id == subscription_user_id,
        UserAddon.addon_id == 5,
        UserAddon.is_active == True
    ).order_by(UserAddon.expiry_date.desc()).first()
    message_addon_expiry = message_addon.expiry_date if message_addon else 'Not Available'

    # 6. Create token (same fields as /login)
    token_data = {
        "sub": target_user.email,
        "role": target_user.role,
        "user_id": subscription_user_id,
        "name": target_user.name,
        "company_name": target_user.company_name,
        "phone_no": target_user.phone_no,
        "total_words_used": target_user.total_words_used,
        "is_team_member": is_team_member,
        "member_id": member_id,
        "subscription_plan_id": subscription_plan_id,
        "subscription_status": user_subscription.status if user_subscription else "new",
        "addon_plan_ids": addon_plan_ids,
        "message_addon_expiry": message_addon_expiry,
        "impersonated_by": current_user["user_id"]  # NEW
    }
    access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # 7. Response (same as /login + impersonated_by)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": target_user.email,
            "name": target_user.name,
            "role": target_user.role,
            "company_name": target_user.company_name,
            "user_id": subscription_user_id,
            "avatar_url": resolve_file_url(target_user.avatar_url),
            "phone_no": target_user.phone_no,
            "subscription_plan_id": subscription_plan_id,
            "total_words_used": target_user.total_words_used,
            "is_team_member": is_team_member,
            "member_id": member_id,
            "addon_plan_ids": addon_plan_ids,
            "message_addon_expiry": message_addon_expiry,
            "subscription_status": user_subscription.status if user_subscription else "new",
            "impersonated_by": current_user["user_id"]  # NEW
        }
    }

@router.get("/customers", response_model=list[str])
def get_all_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow superadmins
    if current_user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Not authorized")

    normal_users = (
    db.query(User)
    .filter(
        
        User.is_verified == True,
        User.user_id != current_user["user_id"]  # exclude self
    )
    .order_by(User.email.asc())
    .all()
)

    # Query users who logged in via Gmail/Google
    google_users  = (
        db.query(User)
        .join(UserAuthProvider, User.user_id == UserAuthProvider.user_id)
        .filter(

            User.user_id != current_user["user_id"]  # exclude self
        )
        .all()
    )

    # Merge both sets, avoid duplicates
    all_customers = {user.email for user in normal_users + google_users}

    return sorted(all_customers)