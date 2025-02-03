from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
from app.models import TokenPayload 
from app.config import GOOGLE_CLIENT_ID , SQLALCHEMY_DATABASE_URL
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.database import get_db


router = APIRouter()

# Route to handle Google Sign-In token
@router.post("/auth/google")
async def google_auth(payload: TokenPayload, db: Session = Depends(get_db)):
    try:
        # Log the incoming payload
        print(f"Received payload: {payload}")
        
        # Validate the token using Google's library
        token_info = id_token.verify_oauth2_token(
            payload.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        print(f"Decoded token info: {token_info}")

        # Return a success message
        return {"message": "Login Successful"}

    except ValueError as e:
        # Log the error for debugging purposes
        print(f"Error decoding token: {e}")
        raise HTTPException(status_code=400, detail="Invalid token")
