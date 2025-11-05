import traceback
from fastapi import APIRouter, Depends, Request,HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from jose import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.config import settings
from app.dependency import get_current_user
from app import schemas
from app.database import get_db
from jose import jwt
from jose.exceptions import JWTError
from app import crud
from app.models import Bot, UserAddon, ChatMessage, Addon, User, UserSubscription, SubscriptionPlan, Interaction, InteractionReaction,BotSlug, Lead
from urllib.parse import urlparse
from sqlalchemy import func, or_
from chromadb import logger
from app.utils.logger import get_module_logger
from pydantic import BaseModel
import threading 
from app.chat_interactions import async_cluster_question, async_update_word_cloud, update_message_counts
from app.chatbot import generate_response
from app.vector_db import retrieve_similar_docs
from app.fetchsubscriptionaddons import update_addon_usage_proper
import uuid
from typing import Optional
from sqlalchemy.future import select       # for select()
from sqlalchemy.ext.asyncio import AsyncSession  # for AsyncSession type hint
import secrets
from app.utils.file_storage import resolve_file_url

# Create a logger for this module
logger = get_module_logger(__name__)

class SendMessageRequestWidget(BaseModel):
    interaction_id: str  # Now a JWT token
    sender: str
    message_text: str
    

router = APIRouter()

def create_bot_token(bot_id: int, expires_in_minutes: int = 15):
    #expire = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    payload = {
        "bot_id": bot_id,       
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token

def create_tokens(interaction_id: int) -> str:
    payload = {"interaction_id": interaction_id}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_bot_slug(bot_id: int, db: Session) -> str:
    # Step 1: Check if a slug already exists for this bot_id
    existing = db.query(BotSlug).filter_by(bot_id=bot_id).first()
    if existing:
        return existing.slug

    # Step 2: Generate a new unique slug
    while True:
        slug = secrets.token_urlsafe(6)[:8]  # Keep it short and clean (optional trim)
        if not db.query(BotSlug).filter_by(slug=slug).first():
            break

    # Step 3: Save to database
    bot_slug = BotSlug(bot_id=bot_id, slug=slug)
    db.add(bot_slug)
    db.commit()
    db.refresh(bot_slug)
    return slug

def decode_interaction_id(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload["interaction_id"]
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid or tampered interaction token")

@router.get("/widget/bot/{bot_id}/token")
def get_bot_token(bot_id: int, current_user=Depends(get_current_user),db: Session = Depends(get_db)):
    # Optional: validate if the user owns the bot
    token = create_bot_slug(bot_id,db)
    return {"token": token}

# @router.get("/bot/{bot_id}", response_model=schemas.BotResponse)
# def get_bot_settings(bot_id: int, db: Session = Depends(get_db)):
#     """Fetch bot settings by bot_id"""
#     bot = crud.get_bot_by_id(db, bot_id)
#     if not bot:
#         raise HTTPException(status_code=404, detail="Bot not found")
#     return bot



@router.get("/widget/bot", response_model=schemas.BotWidgetResponse)
async def get_bot_settings_for_widget(request: Request, db: Session = Depends(get_db)):
    try:

        # 1. Get token from Authorization header
        bot_id = get_bot_id_from_auth_header(request,db)
        logger.info("/widget/bot: %s", bot_id)
        

        # 3. Extract origin from request
        origin = request.headers.get("origin") or request.headers.get("referer")
        if not origin:
            raise HTTPException(status_code=400, detail="Missing origin")
        print("origin",origin)

        origin_parsed = urlparse(origin)
        origin_netloc = f"{origin_parsed.scheme}://{origin_parsed.netloc}"  # e.g. "https://example.com"
        logger.info("The origin of this request %s", origin_netloc)


        # 4. Fetch bot settings from DB
        bot = crud.get_bot_by_id(db, bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.bot_icon:
            bot.bot_icon = resolve_file_url(bot.bot_icon)

        #5. Validate origin (secure your API)
        # 5. Validate origin
        allowed_domains = set()
        server_url_parsed = urlparse(settings.SERVER_URL)
        server_netloc = f"{server_url_parsed.scheme}://{server_url_parsed.netloc}"
        logger.info("The domain entered for Direct link %s", server_netloc)
        allowed_domains.add(server_netloc.strip("/"))

        selected_domain = bot.selected_domain  # e.g. "https://example.com"
        logger.info("selected_domain the user entered for widget%s", selected_domain)
        if selected_domain:
            domain_parsed = urlparse(selected_domain)
            domain_netloc = f"{domain_parsed.scheme}://{domain_parsed.netloc}"
            allowed_domains.add(domain_netloc.strip("/"))
        logger.info("allowed_domains in the API call %s", allowed_domains)
            
        if origin_netloc not in allowed_domains:
                print("error")
                raise HTTPException(status_code=403, detail="Forbidden: Origin not allowed")

        # 6. Return bot settings
        return bot
    except Exception as e:
        print("❌ Error in /widget/bot:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.put("/widget/bots/update-domain")
def update_bot_domain(payload: schemas.UpdateBotDomainRequest, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.bot_id == payload.bot_id).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    bot.selected_domain = payload.selected_domain
    db.commit()
    
    return {"message": "Domain updated successfully"}

@router.get("/widget/bots/{bot_id}/domain")
def get_bot_domain(bot_id: int, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"domain": bot.selected_domain}


@router.get("/api/user/addon/white-labeling-check")
def check_white_labeling_addon(
    request: Request,
    db: Session = Depends(get_db)
):
    # 1. Extract bot_id from Authorization header
    bot_id = get_bot_id_from_auth_header(request,db)
    logger.info("/api/user/addon/white-labeling-check  %s", bot_id)
      
    try:

        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        
        user_id = bot.user_id
        # Check if the user has the White-Labeling addon
        white_label_addon = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            Addon.id == 2,  #  2 for whte labeling
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).first()
        logger.info("/api/user/addon/white-labeling-check  %s", white_label_addon)

        if white_label_addon:
            return {"hasWhiteLabeling": True}
        else:
            return {"hasWhiteLabeling": False}
    
    
    except Exception as e:
        logger.warning("⚠️ Error checking White-Labeling addon:: %s", e)
        raise HTTPException(status_code=500, detail=f"Error checking White-Labeling addon: {str(e)}")
    

@router.get("/api/usage/messages/check")
def check_message_limit(
    request: Request,
    db: Session = Depends(get_db),
):
    bot_id = get_bot_id_from_auth_header(request,db)
    try:
        # Get the bot and extract user_id
        bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")

        user_id = bot.user_id

        
        # Get the user
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user's active subscription
        user_sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'active'
        ).order_by(UserSubscription.payment_date.desc()).first()

        # Get plan limits
        if user_sub:
            plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == user_sub.subscription_plan_id
            ).first()
            base_limit = plan.message_limit if plan else 100
        else:
            return {
            "canSendMessage": False}

        # Calculate total available messages (base + addons)
        total_limit = base_limit
        message_addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            UserAddon.is_active == True,
            #Addon.id == 3,
            Addon.id == 6,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).all()

        for addon in message_addons:
            total_limit += addon.addon.additional_message_limit

        # Check usage
        total_used = user.total_message_count or 0
        can_send = total_used < total_limit

        return {
            "canSendMessage": can_send,
            # "message": "Message limit reached" if not can_send else "",
            # "total_used": total_used,
            # "total_limit": total_limit,
            # "remaining": max(0, total_limit - total_used)
        }

    except Exception as e:
        logger.warning("⚠️ Error checking message limit: %s", e)
        raise HTTPException(status_code=500, detail=f"Error checking message limit: {str(e)}")
    
class StartChatRequest(BaseModel):
    session_id: Optional[str] = None
    
@router.post("/widget/start_chat")
def start_chat_widget(request_data: StartChatRequest,request: Request, db: Session = Depends(get_db)):
    #print("start_chat_widget")

    bot_id = get_bot_id_from_auth_header(request,db)
    #print("bot_idwidget/start_chat",bot_id)
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # ✅ Check bot status - FIRST STEP before creating chat session
    if bot.status != "Active":
        raise HTTPException(status_code=403, detail="Bot is not available for chat at the moment.")

    user_id = bot.user_id
    session_id = request_data.session_id or str(uuid.uuid4()) 
    # print("widget",user_id)
    # print("widget bot",bot_id)
    
    """Creates a new chat session for a user and bot."""
    # logger.info("Bot ID: %s", request.bot_id)
    # logger.info("User ID: %s", request.user_id)

    new_interaction = Interaction(bot_id=bot_id, user_id=user_id,session_id=session_id )
    db.add(new_interaction)
    db.commit()
    db.refresh(new_interaction)
    data_token = create_tokens(new_interaction.interaction_id)
    print("interactionid",data_token)

    return {"interaction_id": data_token}

def get_bot_id_from_auth_header(request: Request,  db: Session) -> int:
    auth_header = request.headers.get("authorization")
    
    if not auth_header or not auth_header.startswith("Bot "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    slug  = auth_header.split("Bot ")[1]
    
    # payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    # bot_id = payload.get("bot_id")
    bot_slug = db.query(BotSlug).filter_by(slug=slug, is_active=True).first()
        
    if not bot_slug:
        raise HTTPException(status_code=401, detail="Invalid or expired bot link")

    return bot_slug.bot_id



    
@router.post("/widget/interactions/reaction")
async def submit_reaction_widget(payload: schemas.ReactionCreateWidget,request: Request, db: Session = Depends(get_db)):
    bot_id = get_bot_id_from_auth_header(request,db)
    
    real_interaction_id = decode_interaction_id(payload.interaction_id)
    real_message_id = decode_interaction_id(payload.message_id)
    print("real_message_id", real_message_id)
    existing = (
        db.query(InteractionReaction)
        .filter_by(interaction_id=real_interaction_id, message_id=real_message_id)
        .first()
    )
    if existing:
        if existing.reaction == payload.reaction:
            # Same reaction sent again — deselect (delete)
            db.delete(existing)
            db.commit()
            return {"message": "Reaction removed."}
        else:
            # Different reaction — update
            existing.reaction = payload.reaction
            db.commit()
            db.refresh(existing)
            return {"message": "Reaction updated."}

    reaction = InteractionReaction(
        interaction_id=real_interaction_id,
        session_id=payload.session_id,
        bot_id=bot_id,
        reaction=payload.reaction,
        message_id = real_message_id
    )
    db.add(reaction)
    db.commit()
    db.refresh(reaction)
    return {"message": "Reaction recorded successfully"}


@router.post("/widget/send_message")
def send_message_from_widget(request: SendMessageRequestWidget,background_tasks: BackgroundTasks, db: Session = Depends(get_db) ):
    """Stores a user message, retrieves relevant context, and generates a bot response."""
    
    print("request.interaction_id0",request.interaction_id)
    real_interaction_id = decode_interaction_id(request.interaction_id)
    logger.debug("real_interaction_id=> %s", real_interaction_id)
    print("real_interaction_id",real_interaction_id)

    # ✅ Check if interaction exists
    interaction = db.query(Interaction).filter(Interaction.interaction_id == real_interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Chat session not found")

    logger.debug("interaction_botid=> %s", interaction.bot_id)

    # ✅ Check bot status - FIRST STEP before any processing
    bot = db.query(Bot).filter(Bot.bot_id == interaction.bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Check if bot is active (ready to chat)
    if bot.status != "Active":
        raise HTTPException(status_code=403, detail="Bot is not available for chat at the moment.")

    # ✅ Retrieve the user from the DB
    user = db.query(User).filter(User.user_id == interaction.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # ✅ Get user's active subscription
    subscription = (
    db.query(UserSubscription)
    .filter(
        UserSubscription.user_id == user.user_id,
        UserSubscription.expiry_date > datetime.utcnow(),  # active subscription
    )
    .order_by(UserSubscription.expiry_date.desc())  # latest valid subscription
    .first()
    )
    print("user.user_id,",user.user_id,)

    if not subscription:
        raise HTTPException(status_code=403, detail="No active subscription found")
    
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.subscription_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    print("plan.message_limit ",plan.message_limit )
    print("user.total_message_count",user.total_message_count)
    print("plan.message_limit is not None",plan.message_limit is not None)
    
    if plan.message_limit is not None and user.total_message_count < plan.message_limit:
        is_base_message = True
    else:
        is_base_message = False
    print("is_base_message",is_base_message)

    

    # ✅ Update message count in background
    if is_base_message:
        threading.Thread(
            target=update_message_counts,
            args=(interaction.bot_id, interaction.user_id)
        ).start()
    else:
        status = check_and_record_addon_usage(
            user_id=user.user_id,          
            background_tasks=background_tasks,  
            messages_used=1,  # or request.messages_used if variable
            db=db,        
        )
        if status == 0:
            return {"message": None, "message_id": None, "error": "Addon limit exceeded"}
            
    print("request.message_text")
    print("real_interaction_id",real_interaction_id)
    print(request.sender)

    # ✅ Store user message with cluster_id=None initially
    user_message = ChatMessage(
        interaction_id=real_interaction_id,
        sender=request.sender,
        message_text=request.message_text,
        cluster_id="temp"
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    print("here 2")

    def is_greeting(msg):
        greetings = ["hi", "hello", "hey", "good morning", "good evening", "good afternoon", "how are you"]
        msg = msg.strip().lower()
        return msg in greetings

    # ✅ Start clustering in background thread if sender is user
    if request.sender.lower() == "user" and not is_greeting(request.message_text):
        threading.Thread(
            target=async_cluster_question,
            args=(interaction.bot_id, request.message_text,user_message.message_id)
        ).start()

        print("Word cloud thread started")
        threading.Thread(
            target=async_update_word_cloud,
            args=(interaction.bot_id, request.message_text)
        ).start()
        

    # ✅ Retrieve context using vector database
    similar_docs = retrieve_similar_docs(interaction.bot_id, request.message_text)
    context = " ".join([doc.get('content', '') for doc in similar_docs]) if similar_docs else "No relevant documents found."

    # ✅ Generate chatbot response using LLM
    bot_reply_dict = generate_response(
        bot_id=interaction.bot_id, 
        user_id=interaction.user_id, 
        user_message=request.message_text, 
        db=db
    )

    # ✅ Extract actual response string
    bot_reply_text = bot_reply_dict["bot_reply"]

    # ✅ Strip Provenance block from the user-facing message
    def strip_provenance_block(text: str) -> str:
        if not text:
            return text
        import re
        # 0) Remove any echoed [METADATA] lines that LLM may have copied from context
        text = re.sub(r"(?im)^\s*\[METADATA\][^\n]*\n?", "", text)
        # 1) Remove everything from the first 'Provenance' (incl. misspellings) to the end
        cleaned = re.sub(r"(?is)(?:provenance|provience|providence)\s*:?(?:\r?\n|\s|$)[\s\S]*$", "", text).rstrip()
        if cleaned != text:
            cleaned = re.sub(r"(?m)^[ \t]*\*[ \t]+", "• ", cleaned)
            return cleaned
        # 2) Fallback: remove trailing contiguous 'source: ...' lines
        lines = text.splitlines()
        i = len(lines) - 1
        while i >= 0:
            raw = lines[i].strip()
            if raw == "":
                i -= 1
                continue
            if re.match(r"^\s*-?\s*source\s*:\s*", raw, re.IGNORECASE):
                i -= 1
                continue
            break
        tail_start = i + 1
        if tail_start < len(lines):
            body = "\n".join(lines[:tail_start]).rstrip()
            body = re.sub(r"(?m)^[ \t]*\*[ \t]+", "• ", body)
            return body
        return re.sub(r"(?m)^[ \t]*\*[ \t]+", "• ", text.rstrip())

    cleaned_bot_reply_text = strip_provenance_block(bot_reply_text)

    # ✅ Parse response for formatting using cleaned text
    from app.utils.response_parser import parse_llm_response
    formatted_content = parse_llm_response(cleaned_bot_reply_text)

    # ✅ Store bot response in DB (cleaned)
    bot_message = ChatMessage(
        interaction_id=real_interaction_id,
        sender="bot",
        message_text=cleaned_bot_reply_text,
        not_answered=bot_reply_dict.get("not_answered", False)
    )
    db.add(bot_message)
    db.commit()

    # If bot couldn't answer, update the user question as well
    if bot_reply_dict.get("not_answered", False):
        db.query(ChatMessage)\
            .filter(ChatMessage.message_id == user_message.message_id)\
            .update({"not_answered": True})
        db.commit()
        
    messageid_data_token = create_tokens(bot_message.message_id)
    print("bot_message.message_id",messageid_data_token)

    document_sources = []

    # ✅ Extract Provenance-based sources from the LLM response (like preview)
    def extract_provenance_sources(text: str):
        sources = []
        if not text:
            return sources
        import re
        # Find start of Provenance block; otherwise fallback to trailing 'source:' lines
        prov_match = re.search(r"(?is)provenance\s*:?(?:\r?\n|\s)", text, re.IGNORECASE)
        lines = []
        if prov_match:
            start_idx = prov_match.end()
            tail = text[start_idx:]
            lines = tail.splitlines()
        else:
            all_lines = text.splitlines()
            i = len(all_lines) - 1
            block = []
            while i >= 0:
                raw = all_lines[i].strip()
                if raw == "":
                    i -= 1
                    continue
                if re.match(r"^\s*-?\s*source\s*:\s*", raw, re.IGNORECASE):
                    block.append(all_lines[i])
                    i -= 1
                    continue
                break
            lines = list(reversed(block)) if block else []
            if not lines:
                # Second fallback: parse any echoed [METADATA] lines to infer sources
                meta_matches = re.findall(r"(?im)^\s*\[METADATA\]\s*([^\n]+)$", text)
                for meta in meta_matches:
                    src_type = None
                    display = None
                    m_src = re.search(r"source\s*:\s*(youtube|website|file|upload)", meta, re.IGNORECASE)
                    if m_src:
                        src_type = m_src.group(1).lower()
                    if src_type in ("youtube", "website"):
                        m_url = re.search(r"(website_url|url)\s*:\s*([^;,\"]+)", meta, re.IGNORECASE)
                        if m_url:
                            display = m_url.group(2).strip().lstrip('@')
                    else:
                        m_fn = re.search(r"file_name\s*:\s*([^;,\"]+)", meta, re.IGNORECASE)
                        if m_fn:
                            display = m_fn.group(1).strip()
                    if src_type and display and display.lower() != 'unknown':
                        sources.append({
                            'type': 'youtube' if src_type == 'youtube' else ('website' if src_type == 'website' else 'file'),
                            'display': display
                        })
                # Deduplicate
                if sources:
                    seen = set()
                    deduped = []
                    for s in sources:
                        key = (s['type'], s['display'])
                        if key in seen:
                            continue
                        seen.add(key)
                        deduped.append(s)
                    return deduped
                return sources
        for line in lines:
            raw = line.strip()
            if not raw:
                # stop at first blank line after provenance
                break
            # Accept with or without leading dash
            if raw.startswith('-'):
                raw = raw.lstrip('-').strip()
            # Must contain a source field
            if 'source' not in raw.lower():
                # if we hit a non-provenance-like line, stop
                break
            # Extract source type
            m_src = re.search(r"source\s*:\s*(youtube|website|file)", raw, re.IGNORECASE)
            if not m_src:
                continue
            src_type = m_src.group(1).lower()
            # Extract value depending on type
            display = None
            if src_type in ('youtube', 'website'):
                m_url = re.search(r'url\s*:\s*([^;,\"]+)', raw, re.IGNORECASE)
                if m_url:
                    display = m_url.group(1).strip()
                    # Remove any leading '@' or stray punctuation
                    display = display.lstrip('@').strip()
            elif src_type == 'file':
                m_fn = re.search(r'filename\s*:\s*([^;,\"]+)', raw, re.IGNORECASE)
                if m_fn:
                    display = m_fn.group(1).strip()
            if not display or display.lower() == 'unknown':
                continue
            sources.append({
                'type': 'youtube' if src_type == 'youtube' else ('website' if src_type == 'website' else 'file'),
                'display': display
            })
        # Deduplicate by (type, display)
        seen = set()
        deduped = []
        for s in sources:
            key = (s['type'], s['display'])
            if key in seen:
                continue
            seen.add(key)
            deduped.append(s)
        return deduped

    # Only show sources if similar to preview logic
    if (
        not is_greeting(request.message_text)
        and not bot_reply_dict.get("is_default_response", False)
        and not bot_reply_dict.get("is_greeting_response", False)
        and not bot_reply_dict.get("is_farewell_response", False)
        and not bot_reply_dict.get("not_answered", False)
        and (similar_docs)
    ):
        # Prefer LLM-provided Provenance lines for sources
        prov_sources = extract_provenance_sources(bot_reply_text)
        if prov_sources:
            for s in prov_sources:
                if s['type'] == 'youtube':
                    document_sources.append({
                        'source': 'youtube',
                        'file_name': '',
                        'website_url': '',
                        'url': s['display']
                    })
                elif s['type'] == 'website':
                    document_sources.append({
                        'source': 'website',
                        'file_name': '',
                        'website_url': s['display'],
                        'url': ''
                    })
                else:
                    document_sources.append({
                        'source': 'upload',
                        'file_name': s['display'],
                        'website_url': '',
                        'url': ''
                    })
            # Optionally include External Knowledge if used
            # (Disabled: do not send sources when info comes from External Knowledge only)
            # if bot_reply_dict.get("used_external", False):
            #     document_sources.append({
            #         'source': 'External Knowledge',
            #         'file_name': 'General Knowledge',
            #         'website_url': '',
            #         'url': ''
            #     })
        #else:
            # No Provenance sources
            # (Disabled: if only External Knowledge was used, do not include sources)
            # if bot_reply_dict.get("used_external", False):
            #     # If model says external knowledge was used and no Provenance was provided,
            #     # do NOT fall back to similar_docs; show only External Knowledge
            #     document_sources.append({
            #         'source': 'External Knowledge',
            #         'website_url': '',
            #         'url': ''
            #     })
    #         elif similar_docs:
    #             # Otherwise, fallback to retrieval hits so sources still show
    #             for doc in similar_docs[:3]:
    #                 md = (doc.get('metadata') or {})
    #                 src = (md.get('source') or '').lower()
    #                 file_name = md.get('file_name') or ''
    #                 website_url = md.get('website_url') or ''
    #                 url = md.get('url') or ''
    #                 if src == 'youtube' and (url or website_url):
    #                     document_sources.append({
    #                         'source': 'youtube',
    #                         'file_name': '',
    #                         'website_url': '',
    #                         'url': url or website_url
    #                     })
    #                 elif src == 'website' and (website_url or url):
    #                     document_sources.append({
    #                         'source': 'website',
    #                         'file_name': '',
    #                         'website_url': website_url or url,
    #                         'url': ''
    #                     })
    #                 elif file_name:
    #                     document_sources.append({
    #                         'source': 'upload',
    #                         'file_name': file_name,
    #                         'website_url': '',
    #                         'url': ''
    #                     })

    # # Deduplicate sources list (in case of duplicates from fallback or LLM)
    # if document_sources:
    #     seen_keys = set()
    #     deduped_sources = []
    #     for s in document_sources:
    #         src_type = (s.get('source') or '').lower().strip()
    #         if src_type == 'youtube':
    #             key_val = (s.get('url') or s.get('website_url') or '').lower().strip()
    #         elif src_type == 'website':
    #             key_val = (s.get('website_url') or s.get('url') or '').lower().strip()
    #         elif src_type == 'external knowledge':
    #             key_val = 'external'
    #         else:
    #             key_val = (s.get('file_name') or '').lower().strip()
    #         key = (src_type, key_val)
    #         if key in seen_keys:
    #             continue
    #         seen_keys.add(key)
    #         deduped_sources.append(s)
    #     document_sources = deduped_sources

    final_is_social = (
        is_greeting(request.message_text)
        or bot_reply_dict.get("is_greeting_response", False)
        or bot_reply_dict.get("is_farewell_response", False)
    )

    return {
        "message": cleaned_bot_reply_text,
        "message_id": messageid_data_token,
        "formatted_content": formatted_content,
        "sources": document_sources,
        "is_greeting": final_is_social
    }

def check_and_record_addon_usage(
    user_id: int,
    background_tasks: BackgroundTasks,
    messages_used: int,
    db: Session
    
):
    try:
        user_addons = db.query(UserAddon).join(Addon).filter(
            UserAddon.user_id == user_id,
            #UserAddon.addon_id == 3,  # Message addon
            UserAddon.addon_id == 6,
            UserAddon.is_active == True,
            or_(
                UserAddon.expiry_date == None,
                UserAddon.expiry_date >= datetime.utcnow()
            )
        ).order_by(UserAddon.id.asc()).all()

        if not user_addons:
            return 0

        total_capacity = sum(addon.addon.additional_message_limit for addon in user_addons)
        total_used = sum(addon.initial_count for addon in user_addons)
        print("total_capacity",total_capacity)
        print("total_used",total_used)
        print("messages_used",messages_used)

        if total_used + messages_used > total_capacity:
            return 0

        background_tasks.add_task(
            update_addon_usage_proper,
            db,
            user_id,
            messages_used
        )
        return 1

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in check_and_record_addon_usage: {str(e)}")
        raise HTTPException(500, "Internal server error")
    


@router.put("/widget/interactions/{interaction_id}/end")
def end_interaction_widget(interaction_id: str, db: Session = Depends(get_db)):
    logger.info("End interaction")
    real_interaction_id = decode_interaction_id(interaction_id)
    interaction = db.query(Interaction).filter(Interaction.interaction_id == real_interaction_id).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    
    # Get the current UTC time
    utc_now = datetime.now(timezone.utc)
    interaction.end_time = utc_now
    logger.debug("interaction.end_time %s", interaction.end_time)
    db.commit()
    return {"message": "Session ended successfully", "end_time": interaction.end_time}


# @router.post("/api/bot-config")
# async def get_bot_config(request: Request):
#     bot_id = get_bot_id_from_auth_header(request)
    
#     # Lookup bot in DB using bot_id
#     bot = await get_bot_from_db(bot_id)  # You write this logic
#     print("bot",bot.avatar_url)
#     print("bot",bot.position)
#     print(bot.welcome_message)
#     print(settings.SERVER_URL.rstrip('/'))
#     if not bot:
#         raise HTTPException(status_code=404, detail="Bot not found")

#     return {
#         "avatarUrl": bot.avatar_url,
#         "position": bot.position,
#         "welcomeMessage": bot.welcome_message,
#         "basedomain": settings.SERVER_URL.rstrip('/'),
#     }


# async def get_bot_from_db(bot_id: int, db: AsyncSession):
#     stmt = select(
#         Bot.bot_icon,
#         Bot.welcome_message,
#         Bot.position,
       
#     ).where(Bot.bot_id == bot_id)

#     result = await db.execute(stmt)
#     bot_data = result.first()

#     if not bot_data:
#         return None

#     bot_icon, welcome_message, position, selected_domain = bot_data

#     return {
#         "bot_icon": bot_icon,
#         "welcome_message": welcome_message,
#         "position": position,
    
#     }

from fastapi.responses import HTMLResponse

@router.get("/embed/{token}", response_class=HTMLResponse)
async def embed_bot(token: str):
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chatbot Preview</title>
        <style>
          html, body {{
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
          }}
        </style>
    </head>
    <body>
        <script
            src="{settings.WIDGET_API_URL}/dist/chatbot-widget.iife.js"
            data-token="{token}"
        ></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@router.get("/bot/{token}", response_class=HTMLResponse)
async def embed_full_bot(token: str,db: Session = Depends(get_db)):
    try:
        # payload = jwt.decode(
        #     token,
        #     settings.SECRET_KEY,
        #     algorithms=[settings.ALGORITHM],
        # )
        # bot_id = payload.get("bot_id")
        bot_slug = db.query(BotSlug).filter_by(slug=token, is_active=True).first()
        bot_id= bot_slug.bot_id
        if not bot_id:
            raise JWTError("bot_id not found in token")
    except JWTError:
        raise HTTPException(401, detail="Invalid token")

    # 2) Fetch the bot row
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(404, detail="Bot not found")

    avatar_url = bot.bot_icon or ""  # fallback to empty string
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Chatbot Full View</title>
        <style>
          html, body {{
              height: 100%;
              margin: 0;
              padding: 0;
          }}
        </style>
    </head>
    <body>
        <script
            src="{settings.WIDGET_API_URL}"
            data-token="{token}"           
            data-appearance="Full Screen"
        ></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/widget/initial/bot", response_model=schemas.BotWidgetInitialResponse)
async def get_bot_initial_settings_for_widget(
    request: Request,
    db: Session = Depends(get_db)
):
    bot_id = get_bot_id_from_auth_header(request,db)
    print("botid",bot_id)

    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    return schemas.BotWidgetInitialResponse(
        avatarUrl=resolve_file_url(bot.bot_icon),
        position=bot.position or "bottom-right",
        welcomeMessage=bot.welcome_message
    )


# Function to insert leads coming from widget
@router.post("/widget/lead")
def insert_lead_from_widget(
    lead: schemas.LeadCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    bot_id = get_bot_id_from_auth_header(request,db)

    # Fetch the bot and associated user
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Create the lead entry
    db_lead = Lead(
        user_id=bot.user_id,
        bot_id=bot_id,
        name=lead.name,
        email=lead.email,
        phone= lead.phone,
        address=lead.address

    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)

    return {"success": True, "lead_id": db_lead.id}