"""Single-user auth and visibility tests.

The API now accepts one shared bearer token and always acts as the local user.
These tests verify that unauthenticated requests are rejected and that the
fixed local user can read and write its own data while other users' data stays hidden.
"""

from tests.helpers.auth import LOCAL_ACCESS_TOKEN, auth_headers
from tests.integration.isolation.conftest import (
    DOC_A_ID,
    DOC_B_ID,
    KB_A_ID,
    KB_B_ID,
)


class TestAuthBoundary:
    async def test_no_auth_header_returns_401(self, client):
        resp = await client.get("/v1/knowledge-bases")
        assert resp.status_code == 401

    async def test_bad_token_returns_401(self, client):
        resp = await client.get(
            "/v1/knowledge-bases",
            headers={"Authorization": "Bearer garbage-token"},
        )
        assert resp.status_code == 401

    async def test_local_access_token_returns_200(self, client):
        resp = await client.get(
            "/v1/knowledge-bases",
            headers={"Authorization": f"Bearer {LOCAL_ACCESS_TOKEN}"},
        )
        assert resp.status_code == 200


class TestVisibility:
    async def test_list_kbs_only_returns_local_user_kb(self, client):
        resp = await client.get("/v1/knowledge-bases", headers=auth_headers())
        assert resp.status_code == 200
        assert [kb["slug"] for kb in resp.json()] == ["alice-kb"]

    async def test_cross_user_kb_is_hidden(self, client):
        resp = await client.get(f"/v1/knowledge-bases/{KB_B_ID}", headers=auth_headers())
        assert resp.status_code == 404

    async def test_cross_user_document_is_hidden(self, client):
        resp = await client.get(f"/v1/documents/{DOC_B_ID}", headers=auth_headers())
        assert resp.status_code == 404

    async def test_local_user_document_is_accessible(self, client):
        resp = await client.get(f"/v1/documents/{DOC_A_ID}", headers=auth_headers())
        assert resp.status_code == 200
        assert resp.json()["filename"] == "notes.md"


class TestWrites:
    async def test_create_note_in_hidden_kb_returns_404(self, client):
        resp = await client.post(
            f"/v1/knowledge-bases/{KB_B_ID}/documents/note",
            headers=auth_headers(),
            json={"filename": "injected.md", "content": "pwned"},
        )
        assert resp.status_code == 404

    async def test_update_hidden_document_returns_404(self, client):
        resp = await client.put(
            f"/v1/documents/{DOC_B_ID}/content",
            headers=auth_headers(),
            json={"content": "overwritten"},
        )
        assert resp.status_code == 404

    async def test_update_local_document_returns_200(self, client):
        resp = await client.put(
            f"/v1/documents/{DOC_A_ID}/content",
            headers=auth_headers(),
            json={"content": "Updated local content"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Updated local content"

    async def test_delete_hidden_kb_returns_404(self, client):
        resp = await client.delete(
            f"/v1/knowledge-bases/{KB_B_ID}",
            headers=auth_headers(),
        )
        assert resp.status_code == 404
