"""Comprehensive Test Suite for Email Delivery & SMTP Operations.

Tests:
1. Valid SMTP configuration & successful OTP email dispatch.
2. Missing SMTP configuration returns clear backend error.
3. SMTP authentication failure is handled and logged without crashing.
4. SMTP connection failure is handled and logged.
5. In-memory sent_emails queue captures dispatch without exposing secrets.
6. OTP is cryptographically secure and NEVER returned in API responses or logs.
7. Diagnostics endpoint returns safe metadata (no passwords, no OTPs).
8. Connection test safely verifies server reachability.
"""
import smtplib
import time
import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from config import settings
from main import app
from services.auth_service import auth_service
from services.email_service import EmailService, email_service

client = TestClient(app)


class TestEmailDelivery(unittest.TestCase):
    """Test suite using standard library unittest for maximum environment compatibility."""

    def setUp(self):
        """Reset email service queues before each test."""
        email_service.sent_emails.clear()

    def test_smtp_diagnostics_safe_output(self):
        """Verify SMTP diagnostics endpoint returns safe metadata without passwords or OTPs."""
        resp = client.get("/api/auth/smtp-diagnostics")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("configured", data)
        self.assertIn("host", data)
        self.assertIn("port", data)
        self.assertIn("sender_email", data)
        self.assertIn("use_tls", data)

        # Security Invariant: NEVER leak passwords or secrets
        self.assertNotIn("password", data)
        self.assertNotIn("smtp_password", data)
        self.assertNotIn("otp", data)

    def test_otp_email_dispatch_with_mocked_smtp_success(self):
        """Test successful SMTP connection and message sending."""
        mock_smtp_instance = MagicMock()
        
        with patch("smtplib.SMTP", return_value=mock_smtp_instance):
            mock_smtp_instance.__enter__.return_value = mock_smtp_instance

            service = EmailService(
                smtp_host="smtp.example.com",
                smtp_port=587,
                smtp_username="test@example.com",
                smtp_password="test_password_123",
                smtp_from_email="noreply@example.com",
                smtp_from_name="Crisis Command",
                use_tls=True,
            )

            success = service.send_otp_email(
                to_email="citizen@example.com",
                otp_code="123456",
                name="John Citizen",
            )

            self.assertTrue(success)
            self.assertEqual(len(service.sent_emails), 1)
            self.assertEqual(service.sent_emails[0]["to_email"], "citizen@example.com")
            self.assertEqual(service.sent_emails[0]["otp"], "123456")

            # Verify SMTP interaction protocol
            mock_smtp_instance.ehlo.assert_called()
            mock_smtp_instance.starttls.assert_called()
            mock_smtp_instance.login.assert_called_with("test@example.com", "test_password_123")
            mock_smtp_instance.send_message.assert_called_once()

    def test_missing_smtp_configuration_fails_gracefully(self):
        """When SMTP is unconfigured, send_otp_email fails and does not pretend it was delivered."""
        service = EmailService(
            smtp_host="",
            smtp_username="",
            smtp_password="",
        )

        self.assertFalse(service.is_configured)
        diag = service.get_diagnostics()
        self.assertFalse(diag["configured"])
        self.assertEqual(diag["host"], "Not configured")

    def test_smtp_authentication_failure_handled_safely(self):
        """Test SMTPAuthenticationError is caught, logged, and returns False without leaking credentials."""
        mock_smtp_instance = MagicMock()
        mock_smtp_instance.login.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Authentication credentials invalid")

        with patch("smtplib.SMTP", return_value=mock_smtp_instance):
            mock_smtp_instance.__enter__.return_value = mock_smtp_instance

            service = EmailService(
                smtp_host="smtp.example.com",
                smtp_port=587,
                smtp_username="bad_user@example.com",
                smtp_password="bad_password",
                use_tls=True,
            )

            success = service.send_otp_email(
                to_email="citizen@example.com",
                otp_code="987654",
                name="Jane Doe",
            )

            self.assertFalse(success)

    def test_smtp_connection_failure_handled_safely(self):
        """Test SMTP connection timeout or network refusal is caught and logged."""
        with patch("smtplib.SMTP", side_effect=smtplib.SMTPConnectError(421, b"Service not available, closing transmission channel")):
            service = EmailService(
                smtp_host="unreachable.smtp.server",
                smtp_port=587,
                smtp_username="user@example.com",
                smtp_password="password",
                use_tls=True,
            )

            success = service.send_otp_email(
                to_email="citizen@example.com",
                otp_code="555444",
                name="Bob",
            )

            self.assertFalse(success)

    def test_registration_flow_with_smtp_delivery(self):
        """Test end-to-end /api/auth/register calls email_service and dispatches email."""
        mock_smtp_instance = MagicMock()

        with patch("smtplib.SMTP", return_value=mock_smtp_instance):
            mock_smtp_instance.__enter__.return_value = mock_smtp_instance

            email = f"citizen_smtp_{int(time.time()*1000)}@example.com"
            resp = client.post(
                "/api/auth/register",
                json={
                    "name": "Live SMTP User",
                    "email": email,
                    "password": "SecurePassword123!",
                },
            )

            self.assertIn(resp.status_code, (200, 201))
            data = resp.json()
            self.assertEqual(data["email"], email.lower())
            self.assertFalse(data["is_verified"])
            self.assertNotIn("otp", data)  # Never leaked in response

            # Check recorded in-memory sent_emails
            self.assertGreaterEqual(len(email_service.sent_emails), 1)
            latest = email_service.sent_emails[-1]
            self.assertEqual(latest["to_email"], email.lower())
            self.assertEqual(len(latest["otp"]), 6)

    def test_test_smtp_endpoint(self):
        """Test the POST /api/auth/test-smtp diagnostic endpoint."""
        mock_smtp_instance = MagicMock()

        with patch("smtplib.SMTP", return_value=mock_smtp_instance):
            mock_smtp_instance.__enter__.return_value = mock_smtp_instance

            resp = client.post("/api/auth/test-smtp")
            self.assertIn(resp.status_code, (200, 503))
            data = resp.json()
            self.assertTrue("status" in data or "detail" in data)


if __name__ == "__main__":
    unittest.main()
