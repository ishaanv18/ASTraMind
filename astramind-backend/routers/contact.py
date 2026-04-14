from fastapi import APIRouter, HTTPException
import httpx
import logging
from pydantic import BaseModel
from config import settings

router = APIRouter()
logger = logging.getLogger("astramind.routers.contact")

class ContactRequest(BaseModel):
    name: str
    email: str
    message: str

@router.post("/contact")
async def handle_contact_form(request: ContactRequest):
    """
    Submits a contact form message via Brevo API (if configured).
    Gracefully logs and returns success if BREVO_API_KEY is not set.
    """
    if not settings.BREVO_API_KEY:
        logger.warning(
            f"[CONTACT MOCK] Received message from {request.name} ({request.email}): {request.message}"
        )
        # Still return success so the frontend UI works and user sees a success message
        return {"status": "success", "message": "Message logged (Brevo API key not configured)."}

    # Prepare Brevo payload
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    # We send the email to ourselves with the sender's info.
    # Note: Brevo requires the sender domain to be verified for production.
    # For now, we set the sender as a generic Astramind system email, and set reply-to as the user.
    payload = {
        "sender": {"name": "Astramind Contact Form", "email": "noreply@astramind.com"},
        "to": [{"email": "support@astramind.com", "name": "Astramind Support"}],
        "replyTo": {"email": request.email, "name": request.name},
        "subject": f"New Contact Request from {request.name}",
        "htmlContent": f"<h3>New Message from ASTraMind Contact Form</h3>"
                       f"<p><strong>Name:</strong> {request.name}</p>"
                       f"<p><strong>Email:</strong> {request.email}</p>"
                       f"<p><strong>Message:</strong><br>{request.message}</p>"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            logger.info(f"Successfully sent contact email from {request.email}")
            return {"status": "success", "message": "Your message has been sent successfully."}
        except httpx.HTTPStatusError as e:
            logger.error(f"Brevo API error: {e.response.text}")
            raise HTTPException(status_code=500, detail="Failed to send message via Brevo.")
        except httpx.RequestError as e:
            logger.error(f"Network error trying to reach Brevo: {e}")
            raise HTTPException(status_code=500, detail="Network error sending message.")
