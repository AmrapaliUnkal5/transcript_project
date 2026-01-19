from apscheduler.schedulers.background import BackgroundScheduler

def init_scheduler():
    """Initialize scheduler for background tasks (currently empty - subscription tasks removed)"""
    scheduler = BackgroundScheduler()
    # No jobs scheduled - subscription/addon tasks removed
    scheduler.start()
    return scheduler