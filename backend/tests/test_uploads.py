# backend/tests/test_uploads.py
import io

def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}

def test_upload_list_is_empty(client, user_and_token):
    _, token = user_and_token
    r = client.get("/upload/me?limit=10&offset=0&sort=created_at&order=desc", headers=_auth(token))
    assert r.status_code == 200
    # Accept either a list (your v1) or {items,total} (your v1.1)
    data = r.json()
    if isinstance(data, dict) and "items" in data:
        assert isinstance(data["items"], list)
        assert data.get("total", 0) >= 0
    else:
        assert isinstance(data, list)

def test_proxy_upload_get_retry_delete_flow(client, user_and_token):
    _, token = user_and_token

    # 1) proxy upload with an in-memory file
    file_bytes = io.BytesIO(b"hello from tests\n")
    files = {"file": ("test-upload.txt", file_bytes, "text/plain")}
    r_up = client.post("/upload/proxy", files=files, headers=_auth(token))
    assert r_up.status_code == 200, r_up.text
    up = r_up.json()
    assert up["filename"].startswith("test-upload")
    upload_id = up["id"]

    # 2) get upload
    r_get = client.get(f"/upload/{upload_id}", headers=_auth(token))
    assert r_get.status_code == 200
    assert r_get.json()["id"] == upload_id

    # 3) list me (should contain at least the new one)
    r_list = client.get("/upload/me?limit=5&offset=0&sort=created_at&order=desc", headers=_auth(token))
    assert r_list.status_code == 200
    data = r_list.json()
    if isinstance(data, dict) and "items" in data:
        ids = [it["id"] for it in data["items"]]
    else:
        ids = [it["id"] for it in data]
    assert upload_id in ids

    # 4) retry (stubbed Celery returns a fake job id)
    r_retry = client.post(f"/upload/{upload_id}/retry", headers=_auth(token))
    assert r_retry.status_code == 200
    body = r_retry.json()
    assert body.get("processor_job_id") is not None

    # 5) delete
    r_del = client.delete(f"/upload/{upload_id}", headers=_auth(token))
    assert r_del.status_code == 200

    # 6) get again -> 404
    r_get2 = client.get(f"/upload/{upload_id}", headers=_auth(token))
    assert r_get2.status_code == 404
