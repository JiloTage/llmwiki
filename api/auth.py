from fastapi import Request

from config import settings

async def get_current_user(request: Request) -> str:
    del request
    return settings.LOCAL_USER_ID
