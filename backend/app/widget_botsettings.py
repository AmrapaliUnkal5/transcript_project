from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from app.dependency import get_current_user

router = APIRouter()

def create_bot_token(bot_id: int, expires_in_minutes: int = 15):
    #expire = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    payload = {
        "bot_id": bot_id,       
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token

@router.get("/widget/bot/{bot_id}/token")
def get_bot_token(bot_id: int, current_user=Depends(get_current_user)):
    # Optional: validate if the user owns the bot
    token = create_bot_token(bot_id)
    return {"token": token}
