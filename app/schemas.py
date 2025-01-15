# app/schemas.py
from pydantic import BaseModel

#creating new users
class UserBase(BaseModel):
    username: str
    email: str
    company_name: str
    role: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int

    class Config:
        orm_mode = True

# Model for login request
class LoginRequest(BaseModel):
    username: str
    password: str