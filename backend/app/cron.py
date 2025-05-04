from apscheduler.schedulers.background import BackgroundScheduler
from app.subscription_cron import handle_subscription_expirations

def init_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        handle_subscription_expirations,
    'interval',
    minutes=1
)
    scheduler.start()
    return scheduler