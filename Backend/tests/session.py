"""Test-client session helpers."""

from fastapi.testclient import TestClient


def drop_session(client: TestClient) -> None:
    """
    Login stores mi_session on this client for later calls.
    A logged-out check has to drop that cookie first.
    """
    client.cookies.clear()
