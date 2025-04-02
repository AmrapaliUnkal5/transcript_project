from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from .database import get_db
from .dependency import get_current_user
from . import crud
from .schemas import (
    TeamMemberCreate, 
    TeamMemberUpdate, 
    TeamMemberResponse, 
    TeamMemberListItem,
    TeamMemberInviteRequest
)
from .models import User
from typing import List, Dict, Any
from .utils.email_helper import send_email
from fastapi.responses import JSONResponse
from app.config import settings

router = APIRouter(prefix="/team", tags=["Team Management"])

# Helper function to send invitation email
def send_invitation_email(
    owner_name: str, 
    owner_email: str, 
    member_email: str, 
    role: str, 
    invitation_token: str
):
    """Send email invitation to team member"""
    subject = f"Invitation to join {owner_name}'s team"
    
    # Create invitation accept link
    invitation_url = f"{settings.BASE_URL}/team/invitation/{invitation_token}"
    
    body = f"""
    Hello,

    {owner_name} ({owner_email}) has invited you to join their team as a {role}.
    
    To accept this invitation, please click on the link below:
    {invitation_url}
    
    If you did not expect this invitation, you can safely ignore this email.

    Best regards,
    Team
    """
    
    send_email(member_email, subject, body)

@router.post("/invite", response_model=dict)
async def invite_team_member(
    background_tasks: BackgroundTasks,
    invite_data: TeamMemberInviteRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invite a user to join current user's team"""
    owner_id = current_user["user_id"]
    
    # Convert from request schema to create schema
    team_member_create = TeamMemberCreate(
        member_email=invite_data.email,
        role=invite_data.role
    )
    
    # Invite the team member
    invite_result, error_message = crud.invite_team_member(db, owner_id, team_member_create)
    
    if error_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    # Get invitee user details
    invitee = db.query(User).filter(User.user_id == invite_result.member_id).first()
    
    # Send invitation email in the background
    background_tasks.add_task(
        send_invitation_email,
        owner_name=current_user["name"],
        owner_email=current_user["email"],
        member_email=invitee.email,
        role=invite_result.role.value,
        invitation_token=invite_result.invitation_token
    )
    
    return {
        "message": f"Invitation sent to {invitee.email}",
        "invitation_id": invite_result.id
    }

@router.get("/members", response_model=List[Dict[str, Any]])
async def get_team_members(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all team members for the current user"""
    owner_id = current_user["user_id"]
    teammembers = crud.get_team_members_by_owner(db, owner_id)
    return teammembers

@router.get("/invitations", response_model=List[Dict[str, Any]])
async def get_pending_invitations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending invitations for the current user"""
    user_id = current_user["user_id"]
    invitations = crud.get_team_invitations_by_user(db, user_id)
    return invitations

@router.get("/teams", response_model=List[Dict[str, Any]])
async def get_my_teams(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all teams the current user is a member of"""
    user_id = current_user["user_id"]
    teams = crud.get_owners_for_user(db, user_id)
    return teams

@router.post("/respond/{invitation_token}")
async def respond_to_invitation(
    invitation_token: str,
    response: str,
    db: Session = Depends(get_db)
):
    """Accept or decline a team invitation"""
    team_member, error_message = crud.respond_to_invitation(db, invitation_token, response)
    
    if error_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    return {
        "message": f"Invitation {response} successfully"
    }

@router.put("/members/{member_id}", response_model=Dict[str, Any])
async def update_team_member_role(
    member_id: int,
    update_data: TeamMemberUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a team member's role"""
    owner_id = current_user["user_id"]
    
    # Check if the team member exists and belongs to the current user
    team_member = db.query(User).filter(
        crud.TeamMember.owner_id == owner_id,
        crud.TeamMember.member_id == member_id
    ).first()
    
    if not team_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )
    
    updated_member = crud.update_team_member(db, team_member.id, update_data)
    
    return {
        "message": "Team member updated successfully",
        "member_id": member_id,
        "role": updated_member.role.value
    }

@router.delete("/members/{member_id}")
async def remove_team_member(
    member_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a team member"""
    owner_id = current_user["user_id"]
    result = crud.remove_team_member(db, owner_id, member_id)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )
    
    return {
        "message": "Team member removed successfully"
    } 