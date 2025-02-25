from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
#from app.database import SessionLocal
from app.models import User
from jose import jwt, JWTError
from app.config import settings ,SQLALCHEMY_DATABASE_URL
from fastapi.responses import JSONResponse
import re
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RoleBasedAccessMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        try:
            if request.method == "OPTIONS":
                return await call_next(request)
            # Bypass authentication for certain endpoints (like login, register)
            EXEMPT_ENDPOINTS = ["/auth/google","/login", "/register", "/forgot-password", "/reset-password","/uploads_bot/","/uploads"] 
            if any(request.url.path.startswith(endpoint) for endpoint in EXEMPT_ENDPOINTS):
                return await call_next(request)

            token = request.headers.get("Authorization")

            if not token:
                return JSONResponse(status_code=401, content={"detail": "Authorization header missing"})
        
            if not token.startswith("Bearer "):
                return JSONResponse(status_code=401, content={"detail": "Invalid token format. Use 'Bearer <token>'"})


            token = token.split("Bearer ")[1]

            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user_email = payload.get("sub")
                if not user_email:
                    return JSONResponse(status_code=401, content={"detail": "Invalid token: missing subject"})
            except JWTError:
                return JSONResponse(status_code=401, content={"detail": "Invalid token: decoding failed"})

            # Database session
            db: Session = SessionLocal()
            print("user")

            user = db.query(User).filter(User.email == user_email).first()
            if not user:
                db.close()
                return JSONResponse(status_code=404, content={"detail": "User not found"})
            print(user)

            #role = db.query(Role).filter(Role.name == user.role).first()
            #if not role:
            #    db.close()
            #    return JSONResponse(status_code=403, content={"detail": "User role not found"})
            #print("role",role)


            # Check if role has permission for this route
            #permissions = (
            #    db.query(Permission.name)
            #    .join(RolesPermission, Permission.id == RolesPermission.permission_id)
            #    .filter(RolesPermission.role_id == role.id)
            #    .all()
            #)
            

            #allowed_permissions = {perm.name for perm in permissions}
            #print("allowed_permissions",allowed_permissions)
            db.close()

            # Define route-to-permission mapping
            #route_permissions = {
               # "/admin": "admin_access",
               # "/performance": "admin_access",
            #    r"^/botsettings/user/\d+$": "admin_access",
                 
                
           #}

            # Function to match the request path against the route_permissions dictionary
            #def get_required_permission(path):
            #    for route_pattern, permission in route_permissions.items():
            #       if re.match(route_pattern, path):
            #            return permission
            #    return None
            #print("request.url.path",request.url.path)

            #required_permission = get_required_permission(request.url.path)
            #print("required_permission",required_permission)
            #if required_permission and required_permission not in allowed_permissions:
            #    return JSONResponse(status_code=403, content={"detail": "Access Denied: Insufficient permissions"})

            return await call_next(request)

        except HTTPException as http_exc:
            return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})

        except Exception as e:
            print(f"Unexpected Error: {str(e)}")  # Log the unexpected error for debugging
            return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
