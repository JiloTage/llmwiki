#!/usr/bin/env python3
"""LLM Wiki GPT Actions endpoint caller."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_BASE_URL = (
    os.environ.get("LLMWIKI_BASE_URL")
    or os.environ.get("APP_URL")
    or os.environ.get("NEXT_PUBLIC_APP_URL")
    or "https://llmwiki.tettoutower.workers.dev"
)

DEFAULT_ACCESS_TOKEN = (
    os.environ.get("LLMWIKI_ACCESS_TOKEN")
    or os.environ.get("LOCAL_ACCESS_TOKEN")
    or os.environ.get("NEXT_PUBLIC_LOCAL_ACCESS_TOKEN")
)

ACTION_PATHS = {
    "guide": "/api/v1/actions/guide",
    "create_wiki": "/api/v1/actions/create-wiki",
    "search": "/api/v1/actions/search",
    "read": "/api/v1/actions/read",
    "write": "/api/v1/actions/write",
    "delete": "/api/v1/actions/delete",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="共有 Bearer token を使って LLM Wiki の GPT Actions endpoint を呼び出します。",
    )
    parser.add_argument(
        "action",
        choices=sorted(ACTION_PATHS),
        help="呼び出す action 名。",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="接続先の base URL。既定値は本番 URL。",
    )
    parser.add_argument(
        "--token",
        default=DEFAULT_ACCESS_TOKEN,
        help="Bearer token。既定では LLMWIKI_ACCESS_TOKEN、LOCAL_ACCESS_TOKEN、NEXT_PUBLIC_LOCAL_ACCESS_TOKEN を順に参照します。",
    )
    parser.add_argument(
        "--data",
        default="{}",
        help="request body として送る JSON object。",
    )
    parser.add_argument(
        "--data-file",
        help="request body に使う JSON file のパス。",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="整形せず compact JSON を出力します。",
    )
    return parser.parse_args()


def load_payload(args: argparse.Namespace) -> dict:
    raw = Path(args.data_file).read_text(encoding="utf-8") if args.data_file else args.data

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"JSON payload が不正です: {exc}") from exc

    if not isinstance(payload, dict):
        raise SystemExit("payload は JSON object である必要があります。")

    return payload


def call_action(base_url: str, token: str | None, action: str, payload: dict) -> tuple[int, object]:
    if not token:
        raise SystemExit(
            "Bearer token がありません。LLMWIKI_ACCESS_TOKEN を設定するか --token を指定してください。"
        )

    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", ACTION_PATHS[action].lstrip("/"))
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            status = response.getcode()
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        raise SystemExit(
            f"{url} への request に失敗しました: {exc.reason}。デプロイ済み URL を使うか、別環境なら --base-url で接続先を指定してください。"
        ) from exc

    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError:
        parsed = {"raw": body}

    return status, parsed


def main() -> int:
    args = parse_args()
    payload = load_payload(args)
    status, body = call_action(args.base_url, args.token, args.action, payload)

    output = {"status": status, "body": body}
    if args.compact:
        print(json.dumps(output, ensure_ascii=False))
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2))

    return 0 if 200 <= status < 300 else 1


if __name__ == "__main__":
    sys.exit(main())
