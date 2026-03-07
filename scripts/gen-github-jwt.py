#!/usr/bin/env python3
"""
gen-github-jwt.py — Generate a GitHub App JWT and (optionally) exchange it for
an installation access token.

Usage:
  # Print JWT only
  python3 scripts/gen-github-jwt.py --pem path/to/private-key.pem --app-id <id>

  # Print JWT + exchange for installation token (for the first installation)
  python3 scripts/gen-github-jwt.py --pem path/to/private-key.pem --app-id <id> --token

  # Specify installation ID explicitly
  python3 scripts/gen-github-jwt.py --pem path/to/private-key.pem --app-id <id> --token --installation-id <id>

Requirements:
  pip install PyJWT cryptography requests

GitHub App JWT spec (RS256, 10-minute max):
  iat  — issued at (60 s in the past to absorb clock drift)
  exp  — expires at (iat + 10 min)
  iss  — client ID or app ID of the GitHub App
  alg  — RS256
"""

import argparse
import sys
import time
from pathlib import Path

try:
    import jwt
except ImportError:
    print("Missing dependency: pip install PyJWT cryptography", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None  # only needed for --token exchange


def build_jwt(pem_path: str, app_id: str) -> str:
    """
    Sign a GitHub App JWT with the RS256 algorithm.

    The payload follows GitHub's spec exactly:
      https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
    """
    pem_bytes = Path(pem_path).read_bytes()
    now = int(time.time())
    payload = {
        "iat": now - 60,          # 60 s in the past — absorbs clock drift
        "exp": now + (10 * 60),   # 10-minute max
        "iss": app_id,
    }
    return jwt.encode(payload, pem_bytes, algorithm="RS256")


def get_installation_token(jwt_token: str, installation_id: str | None) -> dict:
    """
    Exchange a GitHub App JWT for a short-lived installation access token
    (valid 1 hour). Requires requests.
    """
    if requests is None:
        print("Missing dependency: pip install requests", file=sys.stderr)
        sys.exit(1)

    headers = {
        "Accept":               "application/vnd.github+json",
        "Authorization":        f"Bearer {jwt_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    # If no installation ID provided, fetch the first one
    if installation_id is None:
        r = requests.get("https://api.github.com/app/installations", headers=headers, timeout=10)
        r.raise_for_status()
        installations = r.json()
        if not installations:
            print("No installations found for this GitHub App.", file=sys.stderr)
            sys.exit(1)
        installation_id = str(installations[0]["id"])
        print(f"Using installation ID: {installation_id}", file=sys.stderr)

    r = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers=headers,
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a GitHub App JWT (and optionally an installation access token)."
    )
    parser.add_argument("--pem",             required=True,  help="Path to RSA private key PEM file")
    parser.add_argument("--app-id",          required=True,  help="GitHub App client ID or app ID")
    parser.add_argument("--token",           action="store_true",
                        help="Exchange the JWT for an installation access token")
    parser.add_argument("--installation-id", default=None,
                        help="Installation ID (auto-detected from first installation if omitted)")
    args = parser.parse_args()

    jwt_token = build_jwt(args.pem, args.app_id)
    print(f"JWT:\n{jwt_token}\n")

    if args.token:
        result = get_installation_token(jwt_token, args.installation_id)
        print("Installation access token:")
        print(f"  token:      {result['token']}")
        print(f"  expires_at: {result.get('expires_at', 'n/a')}")
        print(f"  permissions: {result.get('permissions', {})}")


if __name__ == "__main__":
    main()
