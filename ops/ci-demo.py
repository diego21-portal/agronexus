"""Exercise the local demo using the images already built by CI."""

import json
import os
import re
import subprocess
from urllib.request import Request, urlopen


ORIGIN = "http://127.0.0.1:18088"
COMPOSE = ("docker", "compose", "-p", f"agronexus-demo-ci-{os.getpid()}", "-f", "ops/compose.demo.yml")
ENVIRONMENT = {
    **os.environ,
    "AGRONEXUS_DEMO_PORT": "18088",
    "AGRONEXUS_DEMO_BACKEND_IMAGE": "agronexus-backend:ci",
    "AGRONEXUS_DEMO_FRONTEND_IMAGE": "agronexus-frontend:ci",
}


def compose(*args, check=True):
    subprocess.run([*COMPOSE, *args], env=ENVIRONMENT, check=check)


def fetch(path, *, method="GET", data=None, access=None):
    headers = {}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if access:
        headers["Authorization"] = f"Bearer {access}"
    request = Request(ORIGIN + path, method=method, headers=headers,
                      data=json.dumps(data).encode() if data is not None else None)
    with urlopen(request, timeout=10) as response:
        return response.read()


def main():
    try:
        compose("up", "--no-build", "--wait", "--wait-timeout", "120")
        assert json.loads(fetch("/health/"))["status"] == "ok"
        html = fetch("/")
        assert b'<div id="root">' in html
        asset = re.search(rb'src="(/assets/[^"\s]+\.js)"', html)
        assert asset and fetch(asset.group(1).decode()), "The frontend bundle is unavailable"
        assert fetch("/account/orders") == html, "Deep links must return the SPA"
        catalog = json.loads(fetch("/api/v1/products/"))
        assert any(row["sku"].startswith("DEMO-") for row in catalog["results"]), "Missing demo products"

        login = json.loads(fetch("/api/v1/auth/login/", method="POST", data={
            "email": "cliente@agronexus.com", "password": "Demo123456",
        }))
        access = login["access"]
        marker = "Cliente de prueba persistente"
        profile = json.loads(fetch("/api/v1/users/me/", method="PATCH", access=access, data={"first_name": marker}))
        assert profile["first_name"] == marker

        compose("up", "--no-build", "--force-recreate", "--wait", "--wait-timeout", "120", "web", "proxy")
        profile = json.loads(fetch("/api/v1/users/me/", access=access))
        assert profile["first_name"] == marker, "Recreating the demo must preserve changes"
        print("Demo Compose passed: fresh install, SPA, catalog, login and PostgreSQL persistence after recreation.")
    except Exception:
        compose("logs", "--tail", "100", check=False)
        raise
    finally:
        compose("down", "--volumes", check=False)


if __name__ == "__main__":
    main()
