from tests.helpers.auth import auth_headers
from tests.integration.isolation.conftest import (
    KB_A_ID,
    USER_A_ID,
)


class TestActionsApi:
    async def test_guide_returns_only_own_knowledge_bases(self, client):
        resp = await client.post("/v1/actions/guide", headers=auth_headers(USER_A_ID))

        assert resp.status_code == 200
        body = resp.json()
        assert "## Core Workflows" in body["instructions"]
        assert [kb["slug"] for kb in body["knowledge_bases"]] == ["alice-kb"]
        assert body["knowledge_bases"][0]["wiki_page_count"] == 1

    async def test_read_returns_markdown_content(self, client):
        resp = await client.post(
            "/v1/actions/read",
            headers=auth_headers(USER_A_ID),
            json={"knowledge_base": "alice-kb", "path": "/wiki/notes.md"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["documents"][0]["content"] == "Alice secret content"

    async def test_read_returns_requested_pdf_pages(self, client, pool):
        pdf_id = "eeee1111-eeee-eeee-eeee-eeeeeeeeeeee"
        await pool.execute(
            "INSERT INTO documents (id, knowledge_base_id, user_id, filename, title, path, file_type, status, page_count) "
            "VALUES ($1, $2, $3, 'report.pdf', 'Report', '/', 'pdf', 'ready', 2)",
            pdf_id,
            KB_A_ID,
            USER_A_ID,
        )
        await pool.execute(
            "INSERT INTO document_pages (document_id, page, content) VALUES ($1, 1, 'Page one text')",
            pdf_id,
        )
        await pool.execute(
            "INSERT INTO document_pages (document_id, page, content) VALUES ($1, 2, 'Page two text')",
            pdf_id,
        )

        resp = await client.post(
            "/v1/actions/read",
            headers=auth_headers(USER_A_ID),
            json={"knowledge_base": "alice-kb", "path": "/report.pdf", "pages": "2"},
        )

        assert resp.status_code == 200
        assert "Page 2" in resp.json()["documents"][0]["content"]
        assert "Page two text" in resp.json()["documents"][0]["content"]

    async def test_write_search_and_delete_roundtrip(self, client, pool):
        content = (
            "# Attention\n\n"
            "Transformers use attention mechanisms to route information across tokens. "
            "This paragraph is intentionally long enough to exceed the minimum chunk size. "
            "Attention helps the model focus on relevant context during generation."
        )

        create_resp = await client.post(
            "/v1/actions/write",
            headers=auth_headers(USER_A_ID),
            json={
                "knowledge_base": "alice-kb",
                "command": "create",
                "path": "/wiki/concepts/",
                "title": "attention-mechanisms",
                "content": content,
                "tags": ["concept"],
            },
        )

        assert create_resp.status_code == 200
        created = create_resp.json()
        assert created["filename"] == "attention-mechanisms.md"

        search_resp = await client.post(
            "/v1/actions/search",
            headers=auth_headers(USER_A_ID),
            json={
                "knowledge_base": "alice-kb",
                "mode": "search",
                "query": "attention",
                "path": "/wiki/**",
            },
        )

        assert search_resp.status_code == 200
        matches = search_resp.json()["matches"]
        assert any(match["filename"] == "attention-mechanisms.md" for match in matches)

        append_resp = await client.post(
            "/v1/actions/write",
            headers=auth_headers(USER_A_ID),
            json={
                "knowledge_base": "alice-kb",
                "command": "append",
                "path": "/wiki/concepts/attention-mechanisms.md",
                "content": "## References\n\n[^1]: source.pdf, p.3",
            },
        )

        assert append_resp.status_code == 200
        assert append_resp.json()["version"] == 1

        delete_resp = await client.post(
            "/v1/actions/delete",
            headers=auth_headers(USER_A_ID),
            json={"knowledge_base": "alice-kb", "path": "/wiki/concepts/attention-mechanisms.md"},
        )

        assert delete_resp.status_code == 200
        assert delete_resp.json()["deleted_paths"] == ["/wiki/concepts/attention-mechanisms.md"]

        archived = await pool.fetchval("SELECT archived FROM documents WHERE path = '/wiki/concepts/' AND filename = 'attention-mechanisms.md'")
        assert archived is True
