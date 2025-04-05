SUBSCRIPTION_PLANS = {
    1: {  # Explorer Plan (Free)
        "id": 1,
        "name": "Explorer",
        "word_count_limit": 50000,
        "file_size_limit_mb": 20,
        "max_files": 10,
        "max_web_pages": 1
    },
    2: {  # Starter Plan
        "id": 2,
        "name": "Starter",
        "word_count_limit": 1000000,
        "file_size_limit_mb": 500,
        "max_files": 50,
        "max_web_pages": 1
    },
    3: {  # Growth Plan
        "id": 3,
        "name": "Growth",
        "word_count_limit": 2000000,
        "file_size_limit_mb": 1024,
        "max_files": 100,
        "max_web_pages": 5
    },
    4: {  # Professional Plan
        "id": 4,
        "name": "Professional",
        "word_count_limit": 3000000,
        "file_size_limit_mb": 2048,
        "max_files": 200,
        "max_web_pages": 10
    }
}

def get_plan_limits(plan_id: int):
    return SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS[1])  # Default to Explorer plan