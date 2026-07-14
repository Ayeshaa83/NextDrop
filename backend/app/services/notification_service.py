"""
In-App Notification Service
============================
Writes a Notification row so the bell dropdown can show it. This is the
in-app counterpart to app/services/email_service.py — admin actions should
call both, not one or the other.
"""
from sqlalchemy.orm import Session

from app.models import Notification, NotificationType


def create(
    db: Session,
    user_id: int,
    type_: NotificationType,
    title: str,
    body: str = "",
    link: str | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id, type=type_.value, title=title, body=body, link=link,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
