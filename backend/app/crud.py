# app/crud.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .models import User, TeamMember, TeamMemberRole
from .schemas import UserCreate, TeamMemberCreate, TeamMemberUpdate
from passlib.context import CryptContext
import secrets
import string
from datetime import datetime, date
from sqlalchemy import func, and_
import enum
from sqlalchemy import text  # Add this import at the top of your file
from sqlalchemy import case
import logging
from app.utils.logger import get_module_logger
from app.utils.file_storage import resolve_file_url

from app import models

from app import schemas

# Create a logger for this module
logger = get_module_logger(__name__)

# Initialize password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Generate a random token for team invitations
def generate_invitation_token(length=32):
    """Generate a random token for team invitations"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password) if user.password else None  # Hash password if provided
    db_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        role=user.role,  # Default role
        is_verified=False,  # Default to unverified
        avatar_url=None,  # Default to None
        phone_no=user.phone_no,
        company_name = user.company_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

# Bot-related functions removed - transcript project doesn't use bots

def update_user_password(db: Session, user_id: int, new_password: str):
    # Hash the new password before storing it in the database
    hashed_password = pwd_context.hash(new_password)

    # Find the user by their ID
    db_user = db.query(User).filter(User.user_id == user_id).first()
    
    if db_user:
        db_user.password = hashed_password  # Update the password with the hashed password
        db.commit()  # Commit the changes to the database
        db.refresh(db_user)  # Refresh to get the latest changes
    return db_user

# Bot-related functions removed - transcript project doesn't use bots


def update_avatar(db: Session, user_id: int, avatar_url: str):
    """
    Update the avatar URL for a user in the database.
    
    Args:
        db (Session): The database session.
        user_id (int): The ID of the user whose avatar is being updated.
        avatar_url (str): The new avatar URL.
    
    Returns:
        User: The updated user object.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return None  # User not found

    user.avatar_url = avatar_url
    db.commit()
    db.refresh(user)
    return user
   
# Bot and file-related functions removed - transcript project doesn't use bots or file uploads for knowledge base

# Team member CRUD operations
def invite_team_member(db: Session, owner_id: int, invite_data: TeamMemberCreate):
    """Invite a user to join a team"""
    
    # Check if the member already exists (based on communication email or email)
    member = db.query(User).filter(User.email == invite_data.member_email).first()

    if member:
        # Check if an invitation already exists
        existing_invite = db.query(TeamMember).filter(
            TeamMember.owner_id == owner_id,
            TeamMember.member_id == member.user_id
        ).first()

        if existing_invite:
            if existing_invite.invitation_status == "accepted":
                return None, "User is already a team member"
            elif existing_invite.invitation_status == "pending":
                return None, "Invitation is already pending"
            elif existing_invite.invitation_status == "declined":
                # Update the declined invitation to pending again
                existing_invite.invitation_status = "pending"
                existing_invite.role = invite_data.role
                existing_invite.invitation_token = generate_invitation_token()
                db.commit()
                db.refresh(existing_invite)
                return existing_invite, None

        
    else:
        # Member does not exist, so create a new user
        logger.debug("Not an existing team member")
        raw_password = "evolrai123"
        hashed_password = pwd_context.hash(raw_password)

        # Generate a username based on email and owner_id
        # safe_email = invite_data.member_email.replace('@', '_at_').replace('.', '_')
        # generated_username = f"{safe_email}_{owner_id}"

        member = User(
            email=invite_data.member_email,  # keeping main email null if desired    
            password=hashed_password,
            role=invite_data.role,
            is_verified=False,
           
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        

    # Create the invitation
    invitation_token = generate_invitation_token()
    new_team_member = TeamMember(
        owner_id=owner_id,
        member_id=member.user_id,
        role=invite_data.role,
        invitation_status="pending",
        invitation_token=invitation_token
    )
    
    db.add(new_team_member)
    db.commit()
    db.refresh(new_team_member)

    return new_team_member, None

def get_team_member(db: Session, id: int):
    """Get a team member by ID"""
    return db.query(TeamMember).filter(TeamMember.id == id).first()

def get_team_members_by_owner(db: Session, owner_id: int):
    """Get all team members for an owner"""
    team_members = db.query(
        TeamMember, 
        User.name.label("member_name"), 
        User.email.label("member_email")
    ).join(
        User, 
        TeamMember.member_id == User.user_id
    ).filter(
        TeamMember.owner_id == owner_id
    ).all()
    
    result = []
    for tm, member_name, member_email in team_members:
        result.append({
            "id": tm.id,
            "member_id": tm.member_id,
            "member_name": member_name,
            "member_email": member_email,
            "role": tm.role.value,
            "invitation_status": tm.invitation_status,
            "invitation_sent_at": tm.invitation_sent_at
        })
    
    return result

def get_team_invitations_by_user(db: Session, user_id: int):
    """Get all pending team invitations for a user"""
    invitations = db.query(
        TeamMember, 
        User.name.label("owner_name"), 
        User.email.label("owner_email")
    ).join(
        User, 
        TeamMember.owner_id == User.user_id
    ).filter(
        TeamMember.member_id == user_id,
        TeamMember.invitation_status == "pending"
    ).all()
    
    result = []
    for inv, owner_name, owner_email in invitations:
        result.append({
            "id": inv.id,
            "owner_id": inv.owner_id,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "role": inv.role.value,
            "invitation_sent_at": inv.invitation_sent_at,
            "invitation_token": inv.invitation_token
        })
    
    return result

def update_team_member(db: Session, id: int, update_data: TeamMemberUpdate):
    """Update a team member's role or invitation status"""
    team_member = db.query(TeamMember).filter(TeamMember.id == id).first()
    
    if not team_member:
        return None
    
    # Update fields that are provided
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(team_member, field, value)
    
    db.commit()
    db.refresh(team_member)
    return team_member

def respond_to_invitation(db: Session, invitation_token: str, response: str):
    """Accept or decline a team invitation"""
    if response not in ["accepted", "declined"]:
        return None, "Invalid response"
    
    team_member = db.query(TeamMember).filter(
        TeamMember.invitation_token == invitation_token,
        TeamMember.invitation_status == "pending"
    ).first()
    
    if not team_member:
        return None, "Invalid or expired invitation"
    
    team_member.invitation_status = response
    team_member.invitation_token = None  # Invalidate the token after response

    if response == "accepted":
        # ✅ Update the member's role in the User table
        user = db.query(User).filter(User.user_id == team_member.member_id).first()
        if user:
            user.role = team_member.role.value  # Match the role in the team invitation
            user.is_verified = True       # Mark user as verified
            db.commit()
    
    db.commit()
    db.refresh(team_member)
    return team_member, None

def remove_team_member(db: Session, owner_id: int, member_id: int):
    """Remove a team member"""
    team_member = db.query(TeamMember).filter(
        TeamMember.owner_id == owner_id,
        TeamMember.member_id == member_id
    ).first()
    
    if not team_member:
        return None
    
    db.delete(team_member)
    # Also delete the user from the Users table
    user_to_delete = db.query(User).filter(User.user_id == member_id).first()
    if user_to_delete:
        db.delete(user_to_delete)
    db.commit()
    return True

def get_owners_for_user(db: Session, user_id: int):
    """Get all owners that a user is a team member for"""
    owner_relationships = db.query(
        TeamMember,
        User.name.label("owner_name"),
        User.email.label("owner_email")
    ).join(
        User,
        TeamMember.owner_id == User.user_id
    ).filter(
        TeamMember.member_id == user_id,
        TeamMember.invitation_status == "accepted"
    ).all()
    
    result = []
    for relationship, owner_name, owner_email in owner_relationships:
        result.append({
            "owner_id": relationship.owner_id,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "role": relationship.role.value
        })
    
    return result
# crud.py
def update_user_word_count(db: Session, user_id: int, word_count: int):
    #logger.debug("User id here: %s", user_id)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.total_words_used += word_count
    db.commit()
    db.refresh(user)
    return user

# Bot theme update removed - transcript project doesn't use bots