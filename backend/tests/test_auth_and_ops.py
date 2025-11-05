# backend/tests/test_auth_and_ops.py
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("ok") is True

def test_login_and_refresh(client, user_and_token):
    _, token = user_and_token

    # /auth/me (sanity)
    r_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200

    # /auth/refresh
    r = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    new_tok = r.json()["access_token"]
    assert isinstance(new_tok, str) and len(new_tok) > 10

def test_ops_queue(client):
    r = client.get("/ops/queue")
    assert r.status_code == 200
    assert "redis" in r.json()
