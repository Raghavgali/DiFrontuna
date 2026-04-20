import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
BOSTON_VIEWBOX = "-71.191,42.227,-70.986,42.397"  # west,south,east,north


def geocode_boston(query: str) -> tuple[float, float] | None:
    """Forward-geocode a Boston address/landmark to (lat, lon). Returns None on failure."""
    q = (query or "").strip()
    if not q:
        return None
    if "boston" not in q.lower():
        q = f"{q}, Boston, MA"
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={
                "q": q,
                "format": "json",
                "limit": "1",
                "viewbox": BOSTON_VIEWBOX,
                "bounded": "1",
            },
            headers={"User-Agent": "Responza/1.0 (hackathon)"},
            timeout=3.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return None
