from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        print("Decoded Token Payload:", payload)  # Debugging
        email: str = payload.get("sub")
        role: str = payload.get("role")
        user_id: int = payload.get("user_id")
        name: str = payload.get("name")  
        company_name: str = payload.get("company_name")  
        phone_no: str = payload.get("phone_no")
        subscription_plan_id: int = payload.get("subscription_plan_id", 1)
        
        if email is None or role is None:
            raise credentials_exception
            
        return {
            "email": email,
            "role": role,
            "user_id": user_id,
            "name": name,  
            "company_name": company_name, 
            "phone_no": phone_no,  
            "subscription_plan_id": subscription_plan_id
        }
    except JWTError as e:
        print("JWT Error:", e)  # Debugging  
    return {
        "email": email,
        "role": role,
        "user_id": user_id,
        "name": name,  
        "company_name": company_name, 
        "phone_no": phone_no,  
        "subscription_plan_id": subscription_plan_id
    }

def require_role(allowed_roles: list[str]):
    """
    Checks if the current user has the required role using RBAC.
    """
    print("You are here")   
    def role_checker(user_data: dict = Depends(get_current_user)):
        if user_data["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return user_data

    return role_checker