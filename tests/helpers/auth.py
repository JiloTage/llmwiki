LOCAL_ACCESS_TOKEN = "local-dev-session"


def auth_headers(*_args, **_kwargs) -> dict[str, str]:
    return {"Authorization": f"Bearer {LOCAL_ACCESS_TOKEN}"}
