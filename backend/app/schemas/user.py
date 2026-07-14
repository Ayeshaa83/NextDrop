from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_premium: Optional[bool] = False

class UserCreate(UserBase):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(UserBase):
    id: int
    role: str = "user"

    class Config:
        from_attributes = True