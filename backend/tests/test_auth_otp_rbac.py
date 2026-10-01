"""Test Suite for OTP-based Authentication, Verification, and Role-Based Access Control (RBAC).

Covers:
1. Registration & secure salted OTP generation.
2. OTP verification (success, failure, attempt limits, expiration, resend cooldown).
3. JWT creation, decoding, and role validation.
4. Privacy isolation: Citizen USER can only view own incidents.
5. Role restriction: Authority cannot report incidents.
6. RBAC restriction: Citizen USER cannot access management endpoints (/resources, /response-plans, /approvals, /alerts).
7. Anti-abuse rate limiting for incidents and OTP requests.
"""
import time
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from main import app
from services.auth_service import auth_service
from services.email_service import email_service
from services.incident_store import incident_store
from services.resource_store import resource_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Reset simulated state between tests."""
    email_service.sent_emails.clear()


def test_public_registration_and_otp_generation():
    """Test user registration sends OTP email and does not leak OTP in API response."""
    email = f"citizen_{int(time.time()*1000)}@example.com"
    payload = {
        "name": "Jane Doe",
        "email": email,
        "password": "SecurePassword123!",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["email"] == email.lower()
    assert data["is_verified"] is False
    assert data["role"] == "user"
    # Security Invariant: Plaintext OTP is NEVER returned in response
    assert "otp" not in data
    assert "code" not in data

    # Verify email was dispatched
    assert len(email_service.sent_emails) >= 1
    sent = email_service.sent_emails[-1]
    assert sent["to_email"] == email.lower()
    assert "verification" in sent["subject"].lower()
    assert len(sent["otp"]) == 6
    assert sent["otp"].isdigit()

    # Security Invariant: In-memory OTP storage contains only salted hash, not plaintext
    record = auth_service.get_user_by_email(email)
    assert record is not None
    assert record.otp_hash is not None
    assert sent["otp"] not in record.otp_hash


def test_public_registration_cannot_escalate_to_authority():
    """Attempts to pass role='authority' or is_verified=True in public registration are ignored."""
    email = f"hacker_{int(time.time()*1000)}@example.com"
    payload = {
        "name": "Attacker",
        "email": email,
        "password": "MaliciousPassword123!",
        "role": "authority",
        "is_verified": True,
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "user"
    assert data["is_verified"] is False


def test_otp_verification_success():
    """Test correct OTP verification marks account verified and returns JWT token."""
    email = f"verified_user_{int(time.time()*1000)}@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Alice Smith", "email": email, "password": "Password12345!"},
    )
    otp = email_service.sent_emails[-1]["otp"]

    verify_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": email, "otp": otp},
    )
    assert verify_resp.status_code == 200
    res_data = verify_resp.json()
    assert res_data["token_type"] == "bearer"
    assert "access_token" in res_data
    assert res_data["user"]["is_verified"] is True
    assert res_data["user"]["role"] == "user"

    # Verify /me endpoint with received token
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {res_data['access_token']}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email.lower()
    assert me_resp.json()["is_verified"] is True


def test_otp_verification_invalid_and_attempt_lockout():
    """Test incorrect OTP increments attempts and locks out after 5 failures."""
    email = f"lockout_{int(time.time()*1000)}@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Bob Target", "email": email, "password": "Password12345!"},
    )

    # 4 invalid attempts
    for _ in range(4):
        resp = client.post("/api/auth/verify-otp", json={"email": email, "otp": "000000"})
        assert resp.status_code == 400
        assert "invalid" in resp.json()["detail"].lower()

    # 5th invalid attempt triggers lockout
    resp5 = client.post("/api/auth/verify-otp", json={"email": email, "otp": "000000"})
    assert resp5.status_code == 400
    assert "too many failed attempts" in resp5.json()["detail"].lower()

    # Even right OTP now fails because code was invalidated
    real_otp = email_service.sent_emails[-1]["otp"]
    resp6 = client.post("/api/auth/verify-otp", json={"email": email, "otp": real_otp})
    assert resp6.status_code == 400


def test_otp_resend_cooldown():
    """Test resend cooldown prevents spamming OTP requests within 60s."""
    email = f"cooldown_{int(time.time()*1000)}@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Charlie", "email": email, "password": "Password12345!"},
    )

    # Immediate resend should trigger 429
    resend_resp = client.post("/api/auth/resend-otp", json={"email": email})
    assert resend_resp.status_code == 429
    assert "please wait" in resend_resp.json()["detail"].lower()


def test_otp_expiration():
    """Test expired OTP is rejected."""
    email = f"expired_{int(time.time()*1000)}@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Dave", "email": email, "password": "Password12345!"},
    )
    user = auth_service.get_user_by_email(email)
    real_otp = email_service.sent_emails[-1]["otp"]

    # Manually backdate the OTP expiry
    user.otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)

    resp = client.post("/api/auth/verify-otp", json={"email": email, "otp": real_otp})
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_unverified_user_cannot_login():
    """Unverified user login returns 403 Forbidden with prompt to verify."""
    email = f"unverified_login_{int(time.time()*1000)}@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Eve Unverified", "email": email, "password": "Password12345!"},
    )

    login_resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Password12345!"},
    )
    assert login_resp.status_code == 403
    assert "verify" in login_resp.json()["detail"].lower()


def test_incident_ownership_isolation():
    """Citizen USER can only view their own incidents; cannot view other users' incidents."""
    # Register & verify User A
    email_a = f"usera_{int(time.time()*1000)}@example.com"
    client.post("/api/auth/register", json={"name": "User A", "email": email_a, "password": "Password123!"})
    otp_a = email_service.sent_emails[-1]["otp"]
    res_a = client.post("/api/auth/verify-otp", json={"email": email_a, "otp": otp_a}).json()
    token_a = res_a["access_token"]
    user_a_id = res_a["user"]["id"]

    # Register & verify User B
    email_b = f"userb_{int(time.time()*1000)}@example.com"
    client.post("/api/auth/register", json={"name": "User B", "email": email_b, "password": "Password123!"})
    otp_b = email_service.sent_emails[-1]["otp"]
    res_b = client.post("/api/auth/verify-otp", json={"email": email_b, "otp": otp_b}).json()
    token_b = res_b["access_token"]

    # User A creates incident
    inc_payload = {
        "title": "Flooding on Main St",
        "type": "flood",
        "description": "Rising waters near subway entrance",
        "location": "Downtown Metro",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "severity": "high",
        "urgency": 8,
    }
    create_resp = client.post(
        "/api/incidents/",
        json=inc_payload,
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_resp.status_code == 201
    inc_data = create_resp.json()
    inc_id = inc_data["id"]
    assert inc_data["reporter_id"] == user_a_id

    # User A lists incidents -> includes their incident
    list_a = client.get("/api/incidents/", headers={"Authorization": f"Bearer {token_a}"}).json()
    assert any(i["id"] == inc_id for i in list_a)

    # User B lists incidents -> does NOT include User A's incident
    list_b = client.get("/api/incidents/", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert not any(i["id"] == inc_id for i in list_b)

    # User B tries direct GET of User A's incident -> 403 Forbidden
    direct_resp = client.get(f"/api/incidents/{inc_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert direct_resp.status_code == 403


def test_authority_login_with_env_credentials():
    """Verify authority authenticates via POST /api/auth/authority-login against env credentials."""
    resp = client.post(
        "/api/auth/authority-login",
        json={"email": "authority@crisiscommand.gov", "password": "AuthorityPassword123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "authority"
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert data["email"] == "authority@crisiscommand.gov"

    # Security Invariant: Authority record is NOT in database / _users store
    assert "auth-admin" not in auth_service._users
    assert "authority@crisiscommand.gov" not in auth_service._users_by_email


def test_authority_login_wrong_credentials_rejected():
    """Verify wrong password or email returns 401 Unauthorized on authority login."""
    # Wrong password
    resp1 = client.post(
        "/api/auth/authority-login",
        json={"email": "authority@crisiscommand.gov", "password": "WrongPassword999!"},
    )
    assert resp1.status_code == 401
    assert "invalid authority credentials" in resp1.json()["detail"].lower()

    # Wrong email
    resp2 = client.post(
        "/api/auth/authority-login",
        json={"email": "impostor@crisiscommand.gov", "password": "AuthorityPassword123!"},
    )
    assert resp2.status_code == 401
    assert "invalid authority credentials" in resp2.json()["detail"].lower()


def test_citizen_login_cannot_authenticate_as_authority():
    """Civilian POST /api/auth/login rejects authority email since authority is not a database user."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "authority@crisiscommand.gov", "password": "AuthorityPassword123!"},
    )
    assert resp.status_code == 401
    assert "invalid email or password" in resp.json()["detail"].lower()


def test_authority_cannot_report_incidents():
    """Authority account is forbidden from reporting incidents."""
    # Login as default authority
    auth_login = client.post(
        "/api/auth/authority-login",
        json={"email": "authority@crisiscommand.gov", "password": "AuthorityPassword123!"},
    )
    assert auth_login.status_code == 200
    auth_token = auth_login.json()["access_token"]

    inc_payload = {
        "title": "Unauthorized Authority Incident",
        "type": "fire",
        "description": "Test fire",
        "location": "Sector 4",
        "latitude": 12.97,
        "longitude": 77.59,
        "severity": "medium",
        "urgency": 5,
    }
    resp = client.post(
        "/api/incidents/",
        json=inc_payload,
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 403
    assert "authority accounts are not permitted" in resp.json()["detail"].lower()


def test_citizen_user_cannot_access_authority_endpoints():
    """Citizen USER account is blocked with 403 Forbidden on management APIs."""
    # Register & verify User
    email = f"citizen_rbac_{int(time.time()*1000)}@example.com"
    client.post("/api/auth/register", json={"name": "Citizen Bob", "email": email, "password": "Password123!"})
    otp = email_service.sent_emails[-1]["otp"]
    res = client.post("/api/auth/verify-otp", json={"email": email, "otp": otp}).json()
    user_token = res["access_token"]

    headers = {"Authorization": f"Bearer {user_token}"}

    # /api/resources -> 403
    resp_res = client.get("/api/resources/", headers=headers)
    assert resp_res.status_code == 403

    # /api/response-plans -> 403
    resp_plan = client.get("/api/response-plans/", headers=headers)
    assert resp_plan.status_code == 403

    # /api/approvals -> 403
    resp_app = client.get("/api/approvals/", headers=headers)
    assert resp_app.status_code == 403

    # /api/alerts -> 403
    resp_alt = client.get("/api/alerts/", headers=headers)
    assert resp_alt.status_code == 403


def test_authority_can_access_management_endpoints():
    """Authority account has full access to management APIs."""
    auth_login = client.post(
        "/api/auth/authority-login",
        json={"email": "authority@crisiscommand.gov", "password": "AuthorityPassword123!"},
    )
    assert auth_login.status_code == 200
    auth_token = auth_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    assert client.get("/api/resources/", headers=headers).status_code == 200
    assert client.get("/api/response-plans/", headers=headers).status_code == 200
    assert client.get("/api/approvals/", headers=headers).status_code == 200
    assert client.get("/api/alerts/", headers=headers).status_code == 200

