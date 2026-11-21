"""Explicit quote preparation for tests whose subject is a completed purchase."""

from uuid import uuid4


QUOTE_URL = "/api/v1/checkout/quote/"
CHECKOUT_URL = "/api/v1/checkout/"


def prepare_checkout_payload(client, address_id, payment_method="SIMULATED_CARD", *, idempotency_key=None):
    """Request the customer's quote, then build one reusable confirmation."""
    params = {"address_id": address_id, "payment_method": payment_method}
    quoted = client.post(QUOTE_URL, params, format="json")
    assert quoted.status_code == 200, quoted.data
    return {
        **params,
        "quote_token": quoted.data["quote_token"],
        "idempotency_key": str(idempotency_key or uuid4()),
    }


def checkout_with_quote(client, params):
    """The test explicitly performs both API steps; no client fixture is patched."""
    payload = prepare_checkout_payload(client, params["address_id"], params["payment_method"])
    return client.post(CHECKOUT_URL, payload, format="json")
