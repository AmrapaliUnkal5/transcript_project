from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.database import get_db
from app.utils.create_access_token import create_access_token
from .models import Base, User, UserAuthProvider
from app.schemas import UserOut,UserUpdate
from app.dependency import get_current_user

router = APIRouter()

@router.get("/user/me", response_model=UserOut)
def get_user_me(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Fetch user details from the database using user_id
    user = db.query(User).filter(User.user_id == current_user["user_id"]).first()
   

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
  

    # Construct the response with additional fields
    return {
        "user_id": user.user_id,
        "name": user.name,  # Ensure `name` is included
        "email": user.email,
        "role": user.role,
        "phone_no":user.phone_no,
        "company_name": user.company_name,  #  Ensure this is included
        "communication_email": user.communication_email,  # Ensure this is included
    }

@router.put("/user/me", response_model=UserOut)
def update_user_me(
    user_update: UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)  # `current_user` is a dictionary
):
    user = db.query(User).filter(User.user_id == current_user["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")


    # Update only provided fields
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user