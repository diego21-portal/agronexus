from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.urls import reverse


@pytest.mark.django_db
def test_readiness_checks_the_database_and_is_not_cached(client):
    response = client.get(reverse("readiness-check"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agronexus-api"}
    assert "no-store" in response.headers["Cache-Control"]


def test_database_outage_affects_readiness_while_liveness_stays_up(client):
    with patch("config.views.connection.cursor", side_effect=OperationalError("Private connection details")) as cursor:
        readiness = client.get(reverse("readiness-check"))
        liveness = client.get(reverse("health-check"))

    cursor.assert_called_once_with()
    assert readiness.status_code == 503
    assert readiness.json() == {"status": "unavailable", "service": "agronexus-api"}
    assert liveness.status_code == 200
