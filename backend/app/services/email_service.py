"""
Email Service
=============
Sends transactional emails over SMTP (Gmail by default). When SMTP
credentials are not configured, emails are logged to the console instead —
every flow keeps working in development.

Callers should send emails from a FastAPI BackgroundTasks so SMTP latency
never blocks a request:  background_tasks.add_task(email_service.send, ...)
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.sec.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def send(to: str, subject: str, html: str) -> bool:
    """Send an email. Returns True when handed to SMTP (or logged in dev mode).
    Never raises — email failures must not break the calling flow."""
    if not is_configured():
        logger.info(
            "[EMAIL console mode] to=%s subject=%r\n%s",
            to, subject, html,
        )
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to], msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s (%s)", to, subject)
        return False


# ──── Templates ─────────────────────────────────────────────────────

def _layout(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    cta = ""
    if cta_label and cta_url:
        cta = (
            f'<p style="margin:28px 0;"><a href="{cta_url}" '
            'style="background:#6366f1;color:#ffffff;text-decoration:none;'
            'padding:12px 28px;border-radius:10px;font-weight:bold;display:inline-block;">'
            f"{cta_label}</a></p>"
        )
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0a0a0b;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #26262b;
                  border-radius:16px;padding:32px;color:#e2e8f0;">
        <h2 style="color:#818cf8;margin-top:0;">NextDrop</h2>
        <h3 style="color:#ffffff;">{title}</h3>
        <div style="font-size:14px;line-height:1.7;color:#cbd5e1;">{body_html}</div>
        {cta}
        <p style="font-size:11px;color:#64748b;margin-top:32px;border-top:1px solid #26262b;padding-top:16px;">
          You're receiving this because you have a NextDrop account. If this wasn't you, you can ignore this email.
        </p>
      </div>
    </div>
    """


def welcome_email(to: str) -> tuple[str, str]:
    return (
        "Welcome to NextDrop 🎧",
        _layout(
            "Your account is live",
            "<p>Welcome aboard! Your NextDrop account has been created.</p>"
            "<p>Next step: set up your artist profile. Once a platform admin approves "
            "your artist profile, you'll be able to upload and distribute music, track "
            "analytics, and collect earnings.</p>",
            "Open NextDrop", settings.FRONTEND_URL,
        ),
    )


def artist_approval_email(to: str, stage_name: str, approved: bool) -> tuple[str, str]:
    if approved:
        return (
            "Your artist profile is approved ✅",
            _layout(
                f"Welcome to the roster, {stage_name}!",
                "<p>An admin has approved your artist profile. You now have full access: "
                "upload releases, distribute to platforms, and track your analytics and earnings.</p>",
                "Upload your first release", f"{settings.FRONTEND_URL}/upload",
            ),
        )
    return (
        "Update on your artist profile",
        _layout(
            f"Hi {stage_name},",
            "<p>Unfortunately your artist profile was not approved at this time. "
            "You can reply to this email or contact support for details.</p>",
        ),
    )


def track_approval_email(to: str, track_title: str, approved: bool, notes: str | None = None) -> tuple[str, str]:
    if approved:
        return (
            f'"{track_title}" has been approved 🚀',
            _layout(
                "Your track passed review",
                f"<p><strong>{track_title}</strong> has been approved and is ready to distribute.</p>",
                "Distribute it now", f"{settings.FRONTEND_URL}/music",
            ),
        )
    return (
        f'"{track_title}" was not approved',
        _layout(
            "Review outcome",
            f"<p><strong>{track_title}</strong> did not pass review.</p>"
            + (f"<p>Reviewer notes: <em>{notes}</em></p>" if notes else "")
            + "<p>You can revise the track and upload it again.</p>",
        ),
    )


def payout_email(to: str, amount: float, completed: bool, reference: str | None = None) -> tuple[str, str]:
    if completed:
        return (
            f"Your payout of ${amount:.2f} is on its way 💸",
            _layout(
                "Payout processed",
                f"<p>Your withdrawal of <strong>${amount:.2f}</strong> has been marked as paid."
                + (f" Reference: <code>{reference}</code>." if reference else "") + "</p>",
                "View earnings", f"{settings.FRONTEND_URL}/earnings",
            ),
        )
    return (
        "Your payout request was declined",
        _layout(
            "Payout update",
            f"<p>Your withdrawal request of <strong>${amount:.2f}</strong> was declined. "
            "The amount has been returned to your wallet balance.</p>",
            "View earnings", f"{settings.FRONTEND_URL}/earnings",
        ),
    )


def password_reset_email(to: str, reset_url: str) -> tuple[str, str]:
    return (
        "Reset your NextDrop password",
        _layout(
            "Password reset requested",
            "<p>Click the button below to choose a new password. "
            f"This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.</p>"
            "<p>If you didn't request this, you can safely ignore this email.</p>",
            "Reset password", reset_url,
        ),
    )
