from fastapi import HTTPException, Request, status

from config import settings


def _unauthorized(detail: str = "Unauthorized") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _extract_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized()
    return token.strip()


async def get_current_user(request: Request) -> str:
    token = _extract_bearer_token(request)
    if token != settings.LOCAL_ACCESS_TOKEN:
        raise _unauthorized("Invalid token")
    return settings.LOCAL_USER_ID
