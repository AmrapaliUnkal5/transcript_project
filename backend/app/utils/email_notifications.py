from app.models import Bot
from .email_helper import send_email
from sqlalchemy.orm import Session

def send_bot_activation_email(db: Session, user_name: str, user_email: str, bot_name: str, bot_id: int):
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        print(f"Bot with ID {bot_id} not found")
        return
    if bot.active_mail_sent:
        print(f"Activation email already sent for bot {bot_id}")
        return
    print("Sending bot activation email")
    subject = "Your chatbot has been activated!"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #000;">
        <p>Hello {user_name},</p>
        <p>Your chatbot \"{bot_name}\" is now active and ready to use.</p>
        <p>You can customize it further by selecting the bot from the homepage if needed.</p>
        <p>Best regards,<br>
        Evolra Admin</p>
    </body>
    </html>
    """
    send_email(user_email, subject, body)
    bot.active_mail_sent = True
    db.commit()

def send_bot_error_email(db: Session, user_name: str, user_email: str, bot_name: str, bot_id: int):
    bot = db.query(Bot).filter(Bot.bot_id == bot_id).first()
    if not bot:
        print(f"Bot with ID {bot_id} not found")
        return
    if bot.error_mail_sent:
        print(f"Error email already sent for bot {bot_id}")
        return
    print("Sending bot Error email")
    subject = "Your Chatbot Creation Failed"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #000;">
        <p>Hello {user_name},</p>
        <p>We regret to inform you that the creation of your chatbot \"{bot_name}\" has failed.</p>
        <p>Please login to your account and check what went wrong with your bot configuration.</p>
        <p>You can try recreating the bot or contact support if you need assistance.</p>
        <p>Best regards,<br>
        Evolra Admin</p>
    </body>
    </html>
    """
    send_email(user_email, subject, body)
    bot.error_mail_sent = True
    db.commit()
