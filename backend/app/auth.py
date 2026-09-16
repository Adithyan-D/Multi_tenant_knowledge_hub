from fastapi import HTTPException, Header, Depends, status
from typing import Optional, Dict, Any
import jwt
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import settings

class AuthenticatedUser:
    def __init__(self, user_id: str, email: Optional[str] = None, token: Optional[str] = None, role: Optional[str] = None, organization_id: Optional[str] = None):
        self.id = user_id
        self.email = email
        self.token = token
        self.role = role
        self.organization_id = organization_id

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_test_user_id: Optional[str] = Header(None),
    x_test_role: Optional[str] = Header(None),
    x_test_org_id: Optional[str] = Header(None)
) -> AuthenticatedUser:
    """
    Extracts authentication credentials from Authorization header or test headers.
    Returns an AuthenticatedUser object.
    """
    token = None
    user_id = None
    email = None
    role = x_test_role or "member"
    org_id = x_test_org_id

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            # Decode JWT payload (without verification if secret key is managed by Supabase Auth,
            # Supabase PostgREST will perform full cryptographic verification on Postgres side)
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub") or payload.get("id")
            email = payload.get("email")
            app_metadata = payload.get("app_metadata", {})
            user_metadata = payload.get("user_metadata", {})
            role = user_metadata.get("role") or app_metadata.get("role") or role
            org_id = user_metadata.get("organization_id") or app_metadata.get("organization_id") or org_id
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Authorization token format: {str(e)}"
            )

    # Support development/testing headers if Authorization token is not present
    if not user_id:
        if x_test_user_id:
            user_id = x_test_user_id
            token = f"mock-token-{user_id}"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing Authorization header or user identity."
            )

    return AuthenticatedUser(
        user_id=user_id,
        email=email,
        token=token,
        role=role,
        organization_id=org_id
    )

def get_supabase_client(user: AuthenticatedUser = Depends(get_current_user)) -> Client:
    """
    Creates a Supabase client initialized with the user's JWT token so PostgreSQL RLS
    is evaluated using auth.uid() automatically.
    """
    headers = {}
    if user.token:
        headers["Authorization"] = f"Bearer {user.token}"
        # Pass test context headers to PostgREST if provided for mock session testing
        if user.id:
            headers["X-Test-User-Id"] = user.id

    client_options = ClientOptions(headers=headers)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY, options=client_options)

def get_service_role_supabase_client() -> Client:
    """
    Creates an admin Supabase client using SUPABASE_SERVICE_ROLE_KEY for admin/seeding operations.
    """
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    return create_client(settings.SUPABASE_URL, key)
