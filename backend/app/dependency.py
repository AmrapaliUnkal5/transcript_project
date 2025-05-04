from requests import Session
from app.middleware import get_db
from app.models import User
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.config import settings
from app.utils.logger import get_module_logger

# Initialize logger
logger = get_module_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        logger.debug("Decoded token payload", extra={"payload": payload})
        
        email: str = payload.get("sub")
        role: str = payload.get("role")
        user_id: int = payload.get("user_id")
        name: str = payload.get("name")  
        company_name: str = payload.get("company_name")  
        phone_no: str = payload.get("phone_no")
        subscription_plan_id: int = payload.get("subscription_plan_id", 1)
        is_team_member:bool = payload.get("is_team_member")
        member_id:int = payload.get("member_id")

        if email is None or role is None:
            logger.warning("Token missing required fields", extra={"email_present": email is not None, "role_present": role is not None})
            raise credentials_exception
            
        logger.debug(f"User authenticated: {email}", extra={"user_id": user_id, "role": role})
        return {
            "email": email,
            "role": role,
            "user_id": user_id,
            "name": name,  
            "company_name": company_name, 
            "phone_no": phone_no,  
            "subscription_plan_id": subscription_plan_id,
            "is_team_member": is_team_member,
            "member_id" : member_id,
        }
    except JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise credentials_exception

def require_role(allowed_roles: list[str]):
    """
    Checks if the current user has the required role using RBAC.
    """
    logger.debug(f"Creating role checker for roles: {allowed_roles}")
    
    def role_checker(user_data: dict = Depends(get_current_user)):
        if user_data["role"] not in allowed_roles:
            logger.warning(
                f"Access denied: User with role '{user_data['role']}' attempted to access resource requiring roles {allowed_roles}",
                extra={"user_id": user_data["user_id"], "email": user_data["email"]}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        
        logger.debug(
            f"Access granted: User with role '{user_data['role']}' authorized for resource",
            extra={"user_id": user_data["user_id"], "email": user_data["email"]}
        )
        return user_data

    return role_checker
    
from app.addon_service import AddonService

def require_addon(addon_type: str):
    """
    Dependency function to check if a user has access to a specific add-on feature
    
    Args:
        addon_type: The type of add-on to check for (e.g., "Multilingual", "White Labelling")
        
    Returns:
        A dependency function that will raise an HTTPException if the user doesn't have the add-on
    """
    def dependency(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        # Skip check for admins (they have access to all features)
        if current_user.role == "admin":
            return current_user
            
        # Check if the user has the required add-on
        has_addon = AddonService.check_addon_active(db, current_user.user_id, addon_type)
        if not has_addon:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires the {addon_type} add-on. Please purchase it to access this functionality."
            )
        
        return current_user
    
    return dependency