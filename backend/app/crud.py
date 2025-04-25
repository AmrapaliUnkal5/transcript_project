# app/crud.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from .models import User, Bot, File, TeamMember, TeamMemberRole,InteractionReaction, ReactionType,Interaction
from .schemas import UserCreate, BotCreate, BotUpdate, BotResponse, TeamMemberCreate, TeamMemberUpdate
from passlib.context import CryptContext
import secrets
import string
from datetime import datetime, date
from sqlalchemy import func, and_
import enum
from sqlalchemy import text  # Add this import at the top of your file
from sqlalchemy import case

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

def get_bot_by_id(db: Session, bot_id: int):
    """Fetch bot settings by bot_id"""
    return db.query(Bot).filter(Bot.bot_id == bot_id).first()

def create_bot(db: Session, bot_data: BotCreate):
    """Insert bot settings if not existing"""
    new_bot = Bot(**bot_data.dict())
    db.add(new_bot)
    db.commit()
    db.refresh(new_bot)
    return new_bot

def update_bot(db: Session, bot_id: int, bot_data: BotUpdate):
    """Update bot settings if already existing"""
    # Fetch the bot from the database
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    
    if not bot:
        return None  # Handle case when bot is not found
    
    #print(f"Incoming bot data: {bot_data.dict()}")
    #print(f"Existing bot data: {bot}")
    
    # Default values for each field (you can adjust these as needed)
    default_values = {
        'user_id': 0,
        'bot_name': 'string',
        'bot_icon': 'string',
        'font_style': 'string',
        'font_size': 0,
        'position': 'string',
        'max_words_per_message': 200,
        'is_active': True,
        'bot_color': 'string',
        'user_color': 'string',
        'appearance':'string',
        'temperature':'number'
    }

    # Update bot object with only provided fields that are different from defaults
    for field, value in bot_data.dict(exclude_unset=True).items():
        current_value = getattr(bot, field)  # Get current value from the database
        
        # Skip update if incoming value is the default one or same as the current value in the database
        if value != default_values.get(field) and value != current_value:
            #print(f"Updating {field} from {current_value} to {value}")
            setattr(bot, field, value)  # Set the new value
    
    db.commit()
    db.refresh(bot)  
    return bot

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

def get_bot_by_user_id(db: Session, user_id: int):
    """Fetch all bot settings for a user_id"""
    bots = db.query(Bot).filter(Bot.user_id == user_id, Bot.status != "Deleted").all()
    bot_ids = [bot.bot_id for bot in bots]

    today_start = datetime.combine(date.today(), datetime.min.time())  # Start of today
    print("today_start",today_start)
    
    today_end = datetime.combine(date.today(), datetime.max.time())  # End of today
    print("today_end",today_end)

    # Get conversation count per bot for today
    bot_conversation_counts = (
        db.query(Interaction.bot_id, func.count().label("conversation_count"))
        .filter(
            Interaction.bot_id.in_([bot.bot_id for bot in bots]),  # Filter interactions of these bots
            Interaction.start_time.between(today_start, today_end)  # Only today's interactions
        )
        .group_by(Interaction.bot_id)
        .all()
    )

    # Convert results to a dictionary for quick lookup
    bot_conversation_dict = {bot_id: count for bot_id, count in bot_conversation_counts}

       
    # Get reaction counts - PROPER ENUM USAGE
    reaction_counts = (
        db.query(
            InteractionReaction.bot_id,
            func.sum(case((InteractionReaction.reaction == ReactionType.LIKE.value, 1), else_=0)).label("like"),
            func.sum(case((InteractionReaction.reaction == ReactionType.DISLIKE.value, 1), else_=0)).label("dislike")
        )
        .filter(InteractionReaction.bot_id.in_(bot_ids),
                 InteractionReaction.reaction_time.between(today_start, today_end)  # ✅ Only today's reactions
        )
        .group_by(InteractionReaction.bot_id)
        .all()
    )

    bot_reaction_dict = {
        row.bot_id: {
            "like": row.like or 0,
            "dislike": row.dislike or 0
        }
        for row in reaction_counts
    }
    
    if not bots:
        return []

    return [{bot.bot_id: {
        "user_id": bot.user_id,
        "bot_name": bot.bot_name,
        "bot_icon": bot.bot_icon,
        "font_style": bot.font_style,
        "font_size": bot.font_size,
        "position": bot.position,
        "max_words_per_message": bot.max_words_per_message,
        "is_active": bot.is_active,
        "bot_color":bot.bot_color,
        "user_color":bot.user_color,
        "appearance":bot.appearance,
        "temperature":bot.temperature,
        "status":bot.status,
        "conversation_count_today": bot_conversation_dict.get(bot.bot_id, 0),  # Default to 0 if no interactions
        "satisfaction": {
                "likes": bot_reaction_dict.get(bot.bot_id, {}).get("like", 0),
                "dislikes": bot_reaction_dict.get(bot.bot_id, {}).get("dislike", 0)
            }
    }} for bot in bots]


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
   
def create_file(db: Session, file_data: dict):
    """Insert file metadata into the database."""
    db_file = File(**file_data)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file     


def delete_bot(db: Session, bot_id: int):
    """Soft delete a bot by updating its status to 'Deleted'"""
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()

    # Get the user associated with this bot
    user = db.query(User).filter(User.user_id == bot.user_id).first()
    
    if user:
        # Subtract the bot's word count from the user's total (if bot has word count)
        if bot.word_count:
            user.total_words_used = max(0, (user.total_words_used or 0) - bot.word_count)
        if bot.file_size:
            user.total_file_size=max(0,(user.total_file_size or 0)- bot.file_size)
        if bot.message_count:
            user.total_message_count=max(0,( user.total_message_count or 0)- bot.message_count)
    
    if not bot:
        return None  # Return None if bot not found

    # Set status to "Deleted"
    bot.status = "Deleted"
    bot.is_active = False

    db.commit()
    db.refresh(bot)
    return bot  # Return updated bot

# Team member CRUD operations
def invite_team_member(db: Session, owner_id: int, invite_data: TeamMemberCreate):
    """Invite a user to join a team"""
    # Check if the member email exists
    member = db.query(User).filter(User.email == invite_data.member_email).first()
    
    # If member doesn't exist, return None (handled in API endpoint)
    if not member:
        return None, "User not found"
    
    # Check if the invitation already exists
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
    
    # Create a new invitation
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
    print("User id here ",user_id)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.total_words_used += word_count
    db.commit()
    db.refresh(user)
    return user