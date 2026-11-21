"""Safely diagnose the data.gov.in Agmarknet API connection.

Run from any working directory with the project's Python environment. This
script never prints the API key, request URL, response body, or price values.
"""

from __future__ import annotations

import os
import socket
import threading
from pathlib import Path

import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
HOST = "api.data.gov.in"
RESOURCE_DEFAULT = "9ef84268-d588-465a-a308-a864a43d0070"
DNS_TIMEOUT_SECONDS = 3
CONNECT_TIMEOUT_SECONDS = 3
READ_TIMEOUT_SECONDS = 5


def main() -> int:
    if not ENV_FILE.is_file():
        print("Root .env file: not found")
        return 2

    load_dotenv(dotenv_path=ENV_FILE, override=False)
    api_key = os.getenv("DATA_GOV_IN_API_KEY", "").strip()
    resource_id = os.getenv("AGMARKNET_RESOURCE_ID", RESOURCE_DEFAULT).strip() or RESOURCE_DEFAULT

    print("Root .env file: found")
    print(f"DATA_GOV_IN_API_KEY configured: {'yes' if api_key else 'no'} (value hidden)")
    print(f"Agmarknet resource configured: {'yes' if resource_id else 'no'}")

    dns_result: dict[str, object] = {}

    def resolve_host() -> None:
        try:
            dns_result["addresses"] = socket.getaddrinfo(HOST, 443, type=socket.SOCK_STREAM)
        except OSError as exc:
            dns_result["exception_type"] = type(exc).__name__

    dns_thread = threading.Thread(target=resolve_host, name="mandi-dns-check", daemon=True)
    dns_thread.start()
    dns_thread.join(DNS_TIMEOUT_SECONDS)
    if dns_thread.is_alive():
        print(f"DNS: failed (exception type: TimeoutError, limit: {DNS_TIMEOUT_SECONDS}s)")
        addresses = []
    elif "exception_type" in dns_result:
        print(f"DNS: failed (exception type: {dns_result['exception_type']})")
        addresses = []
    else:
        addresses = dns_result.get("addresses", [])
        print(f"DNS: resolved ({len(addresses)} address record(s))")

    try:
        with socket.create_connection((HOST, 443), timeout=CONNECT_TIMEOUT_SECONDS):
            print(f"TCP connection to {HOST}:443: succeeded")
    except OSError as exc:
        print(f"TCP connection to {HOST}:443: failed (exception type: {type(exc).__name__})")

    if not api_key:
        print("HTTP status: not requested (API key is not configured)")
        print("Exception type: none")
        return 2

    if not addresses:
        print("HTTP status: not requested (DNS resolution failed)")
        print("Exception type: socket.gaierror")
        return 1

    endpoint = f"https://{HOST}/resource/{resource_id}"
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": 1,
    }
    try:
        response = requests.get(
            endpoint,
            params=params,
            timeout=(CONNECT_TIMEOUT_SECONDS, READ_TIMEOUT_SECONDS),
        )
        print(f"HTTPS/API HTTP status: {response.status_code}")
        print("Exception type: none")
        if response.status_code == 200:
            try:
                payload = response.json()
            except ValueError:
                print("Response format: non-JSON")
                return 1
            if isinstance(payload, dict):
                print(f"JSON response: valid; record count: {len(payload.get('records', []))}")
            else:
                print(f"JSON response: unexpected type ({type(payload).__name__})")
                return 1
            return 0
        return 1
    except requests.RequestException as exc:
        # Do not print str(exc), repr(exc), the prepared request, or its URL:
        # requests exceptions can contain the query string, including the key.
        print("HTTPS/API HTTP status: not received")
        print(f"Exception type: {type(exc).__name__}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
