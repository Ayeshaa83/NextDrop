"""
In-App Notifications
=====================
Powers the notification bell: list (paginated), unread count, mark-as-read.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.api import deps
from app.api.pagination import PaginationParams, PaginatedResponse, paginate
from app.models import User, Notification

router = APIRouter()


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    body: str
    link: str | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """The current user's notifications, newest first."""
    query = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    total = query.count()
    items = query.offset(pagination.skip).limit(pagination.limit).all()
    return paginate(items, total, pagination.skip, pagination.limit)


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Lightweight endpoint for polling the bell badge count."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
