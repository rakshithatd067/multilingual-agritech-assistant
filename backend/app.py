"""Flask API for the Multilingual Agritech Assistant."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
ENV_FILE = PROJECT_ROOT / ".env"
# Resolve the environment file from this module, not the shell's working directory.
load_dotenv(dotenv_path=ENV_FILE, override=False)
DATABASE = Path(os.getenv("DATABASE_PATH", str(BASE_DIR / "agritech.db")))
LANGUAGES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")}})


@contextmanager
def db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL,
                content TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'en',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS soil_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT, soil_type TEXT NOT NULL,
                ph REAL, nitrogen REAL, phosphorus REAL, potassium REAL,
                recommendations TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """)


def get_json(url: str, params: dict[str, Any], source: str) -> dict[str, Any]:
    host = urlsplit(url).hostname or "unknown-host"
    timeout_seconds = 12
    try:
        response = requests.get(url, params=params, timeout=timeout_seconds)
    except requests.Timeout as exc:
        app.logger.warning(
            "%s request timed out: host=%s timeout_seconds=%s exception_type=%s",
            source, host, timeout_seconds, type(exc).__name__,
        )
        raise ValueError(f"{source} did not respond before the request timed out.") from exc
    except requests.ConnectionError as exc:
        app.logger.warning(
            "%s connection failed: host=%s exception_type=%s",
            source, host, type(exc).__name__,
        )
        raise ValueError(f"The Flask backend could not connect to {host}.") from exc
    except requests.RequestException as exc:
        # Do not log the exception or URL: requests may include query parameters such as API keys.
        app.logger.warning(
            "%s request failed: host=%s exception_type=%s",
            source, host, type(exc).__name__,
        )
        raise ValueError(f"{source} request failed. Check the backend network connection and retry.") from exc

    if response.status_code >= 400:
        app.logger.warning(
            "%s returned an HTTP error: host=%s status_code=%s",
            source, host, response.status_code,
        )
        # Avoid forwarding/logging provider bodies that could echo request credentials.
        raise ValueError(
            f"{source} returned HTTP {response.status_code}. Verify API access and resource configuration."
        )

    try:
        data = response.json()
    except ValueError as exc:
        app.logger.warning(
            "%s returned invalid JSON: host=%s status_code=%s content_type=%s",
            source, host, response.status_code, response.headers.get("Content-Type", "not-supplied"),
        )
        raise ValueError(f"{source} returned an unreadable response.") from exc
    if not isinstance(data, dict):
        app.logger.warning(
            "%s returned an unexpected JSON type: host=%s status_code=%s type=%s",
            source, host, response.status_code, type(data).__name__,
        )
        raise ValueError(f"{source} returned an unexpected response format.")
    return data


def weather_for(location: str) -> dict[str, Any]:
    key = os.getenv("OPENWEATHER_API_KEY")
    if not key:
        raise ValueError("Weather data is unavailable. Add OPENWEATHER_API_KEY to your .env file.")
    current_data = get_json("https://api.openweathermap.org/data/2.5/weather", {
        "q": location, "appid": key, "units": "metric",
    }, "Weather service")
    data = get_json("https://api.openweathermap.org/data/2.5/forecast", {
        "q": location, "appid": key, "units": "metric", "cnt": 40,
    }, "Weather service")
    rows = data.get("list", [])
    if not rows:
        raise ValueError("No forecast data was returned for that location.")
    location_timezone = timezone(timedelta(seconds=int(data.get("city", {}).get("timezone", 0))))
    today = datetime.now(location_timezone).date()
    today_rows = [row for row in rows if datetime.fromtimestamp(row["dt"], timezone.utc).astimezone(location_timezone).date() == today]
    today_rows = today_rows or rows[:8]
    rainfall = round(sum(float(row.get("rain", {}).get("3h", 0)) for row in today_rows), 1) if today_rows else None
    daily: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        day = datetime.fromtimestamp(row["dt"], timezone.utc).astimezone(location_timezone).date().isoformat()
        daily.setdefault(day, []).append(row)
    forecast = []
    for day, samples in list(daily.items())[:5]:
        noon = min(samples, key=lambda x: abs(datetime.fromtimestamp(x["dt"], timezone.utc).hour - 12))
        forecast.append({"date": day, "min": round(min(x["main"]["temp_min"] for x in samples)),
                         "max": round(max(x["main"]["temp_max"] for x in samples)),
                         "description": noon["weather"][0]["description"],
                         "icon": noon["weather"][0]["icon"],
                         "rainfall_mm": round(sum(float(x.get("rain", {}).get("3h", 0)) for x in samples), 1)})
    current_weather = current_data.get("weather", [{}])[0]
    advice = []
    if rainfall is not None and rainfall >= 5:
        advice.append("Rain is forecast today; check field drainage and postpone spraying until leaves are dry.")
    elif current_data["main"].get("humidity", 0) < 35:
        advice.append("Low humidity is forecast; check soil moisture and irrigate based on crop needs.")
    else:
        advice.append("Use the forecast to plan field work, and check soil moisture before irrigation.")
    return {"location": data.get("city", {}).get("name", location), "country": data.get("city", {}).get("country", ""),
            "temperature_c": round(current_data["main"]["temp"]), "feels_like_c": round(current_data["main"]["feels_like"]),
            "humidity_pct": current_data["main"]["humidity"], "rainfall_today_mm": rainfall,
            "description": current_weather.get("description", ""), "icon": current_weather.get("icon"),
            "updated_at": datetime.now(timezone.utc).isoformat(), "forecast": forecast, "advice": advice,
            "source": "OpenWeather 5 day / 3 hour forecast"}


def mandi_prices(crop: str, state: str = "") -> dict[str, Any]:
    key = os.getenv("DATA_GOV_IN_API_KEY")
    if not key:
        raise ValueError("Mandi data is unavailable. Add DATA_GOV_IN_API_KEY to your .env file.")
    resource = os.getenv("AGMARKNET_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070")
    params: dict[str, Any] = {"api-key": key, "format": "json", "limit": 50, "filters[commodity]": crop}
    if state:
        params["filters[state]"] = state
    data = get_json(f"https://api.data.gov.in/resource/{resource}", params, "Mandi price service")
    records = data.get("records", [])
    if not records:
        raise ValueError(f"No current mandi records were found for {crop}. Try another crop or state.")
    return {"records": [{"commodity": row.get("commodity", crop), "market": row.get("market", "Unknown market"),
                          "state": row.get("state", ""), "district": row.get("district", ""),
                          "variety": row.get("variety", ""), "grade": row.get("grade", ""),
                          "min_price": row.get("min_price"), "max_price": row.get("max_price"),
                          "modal_price": row.get("modal_price"), "arrival_date": row.get("arrival_date", "")}
                         for row in records], "source": "data.gov.in (Agmarknet)", "retrieved_at": datetime.now(timezone.utc).isoformat()}


def recommend_crops(payload: dict[str, Any]) -> dict[str, Any]:
    soil = str(payload.get("soil_type", "")).strip().lower()
    try:
        ph = float(payload["ph"]) if payload.get("ph") not in (None, "") else None
        n = float(payload["nitrogen"]) if payload.get("nitrogen") not in (None, "") else None
        p = float(payload["phosphorus"]) if payload.get("phosphorus") not in (None, "") else None
        k = float(payload["potassium"]) if payload.get("potassium") not in (None, "") else None
    except (ValueError, TypeError):
        raise ValueError("Nutrient values and pH must be numbers.")
    if ph is not None and not 0 <= ph <= 14:
        raise ValueError("Soil pH must be between 0 and 14.")
    profiles = [
        {"crop": "Rice", "soils": ("clay", "loam", "alluvial"), "ph": (5.5, 7.0), "planting": "Transplant healthy seedlings at the onset of reliable water availability; maintain shallow water where suitable.", "harvest": "Usually about 3–5 months after planting, depending on variety.", "protection": "Monitor for stem borer and leaf folder; use locally recommended integrated pest management."},
        {"crop": "Millet", "soils": ("sandy", "loam", "red", "black"), "ph": (5.5, 7.5), "planting": "Sow with the first dependable monsoon rains, using a locally adapted variety.", "harvest": "Usually about 2.5–4 months after sowing, depending on variety.", "protection": "Use clean seed, rotate crops, and scout regularly for shoot fly and head pests."},
        {"crop": "Groundnut", "soils": ("sandy", "loam", "red"), "ph": (6.0, 7.0), "planting": "Sow into well-drained soil when warm conditions and reliable moisture are available.", "harvest": "Usually about 3–5 months after sowing, depending on variety.", "protection": "Avoid waterlogging; monitor leaf spots and use locally approved integrated management."},
        {"crop": "Maize", "soils": ("loam", "alluvial", "black", "red"), "ph": (5.8, 7.0), "planting": "Plant at the start of the suitable local season in moist, well-drained soil.", "harvest": "Usually about 3–4 months after sowing, depending on variety and use.", "protection": "Scout for fall armyworm and follow local extension guidance before any treatment."},
        {"crop": "Pulses", "soils": ("loam", "sandy", "black", "red"), "ph": (6.0, 7.5), "planting": "Choose a pulse suited to your season and sow in well-drained soil with recommended spacing.", "harvest": "Often about 2.5–5 months after sowing, depending on the pulse and variety.", "protection": "Rotate crops and scout for pod borers; use locally approved integrated pest management."},
        {"crop": "Cotton", "soils": ("black", "loam", "alluvial"), "ph": (5.8, 8.0), "planting": "Plant a locally approved variety at the recommended sowing window and spacing.", "harvest": "Picking commonly begins about 5–7 months after sowing, depending on variety.", "protection": "Scout for sucking pests and bollworms; follow local resistance-management advice."},
    ]
    scored = []
    for item in profiles:
        score = 0
        reasons = []
        if soil and any(token in soil for token in item["soils"]):
            score += 2
            reasons.append("soil type is a broad match")
        if ph is not None and item["ph"][0] <= ph <= item["ph"][1]:
            score += 2
            reasons.append("reported pH is within a broad suitable range")
        if n is not None and n < 20 and item["crop"] in ("Rice", "Maize", "Cotton"):
            reasons.append("nitrogen is low; seek a soil-test-based nutrient plan")
        if p is not None or k is not None:
            reasons.append("consider the soil-test nutrient values with local extension advice")
        scored.append((score, item, reasons))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = [{"crop": item["crop"], "match": "Better match" if score >= 2 else "Consider locally",
                "reasons": reasons or ["More location and soil-test context is needed"], "planting": item["planting"],
                "harvest": item["harvest"], "protection": item["protection"]} for score, item, reasons in scored[:4]]
    with db() as conn:
        conn.execute("INSERT INTO soil_checks (soil_type, ph, nitrogen, phosphorus, potassium, recommendations) VALUES (?, ?, ?, ?, ?, ?)",
                     (soil, ph, n, p, k, str([x["crop"] for x in results])))
    return {"recommendations": results, "disclaimer": "These are broad, non-guaranteed suggestions based on limited inputs. Confirm crop choice, season, variety, nutrient needs and pest control with your local agricultural extension service and a soil test."}


def chat_reply(message: str, language: str) -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("AI chat is unavailable. Add GROQ_API_KEY to your .env file.")
    language_name = LANGUAGES[language]
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    response = requests.post("https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "temperature": 0.4, "messages": [
            {"role": "system", "content": f"You are a cautious agricultural information assistant. Reply in {language_name}, using simple language. State uncertainty. Never invent live weather or market prices; say these require current verified data. Distinguish general suggestions from verified data. Do not promise yield or profit. Encourage local agricultural extension advice for high impact pesticide, disease, and nutrient decisions."},
            {"role": "user", "content": message}], "max_tokens": 700}, timeout=30)
    if response.status_code >= 400:
        raise ValueError("The AI service could not complete the request. Check your Groq key, model and quota.")
    result = response.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    if not result:
        raise ValueError("The AI service returned an empty response. Please try again.")
    return result


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "agritech-api"})


@app.get("/api/dashboard")
def dashboard():
    with db() as conn:
        messages = conn.execute("SELECT COUNT(*) AS count FROM chat_messages").fetchone()["count"]
        checks = conn.execute("SELECT COUNT(*) AS count FROM soil_checks").fetchone()["count"]
        pref = conn.execute("SELECT value FROM preferences WHERE key='location'").fetchone()
    return jsonify({"welcome": "Good decisions start with local information.", "location": pref["value"] if pref else "",
                    "recent_activity": {"chat_messages": messages, "soil_checks": checks},
                    "services": {"weather": bool(os.getenv("OPENWEATHER_API_KEY")), "mandi": bool(os.getenv("DATA_GOV_IN_API_KEY")), "ai": bool(os.getenv("GROQ_API_KEY"))}})


@app.post("/api/weather")
def weather():
    location = str((request.get_json(silent=True) or {}).get("location", "")).strip()
    if not location or len(location) > 120:
        return jsonify({"error": "Enter a valid town, city or district."}), 400
    try:
        data = weather_for(location)
        with db() as conn:
            conn.execute("INSERT INTO preferences (key, value, updated_at) VALUES ('location', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", (location,))
        return jsonify(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 503


@app.post("/api/mandi")
def mandi():
    try:
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "Submit the crop search as a JSON object."}), 400
        crop, state = str(payload.get("crop", "")).strip(), str(payload.get("state", "")).strip()
        if not crop or len(crop) > 80:
            return jsonify({"error": "Enter a crop name to search."}), 400
        return jsonify(mandi_prices(crop, state))
    except ValueError as exc:
        upstream_error = exc.__cause__
        if isinstance(upstream_error, requests.Timeout):
            return jsonify({"error": "data.gov.in did not respond before the request timed out. Please retry; no price data was returned."}), 503
        if isinstance(upstream_error, requests.ConnectionError):
            return jsonify({"error": "The Flask backend could not connect to api.data.gov.in. Check outbound internet/DNS access from this machine and retry."}), 503
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        # Keep unexpected failures diagnosable by type without logging exception text,
        # which can contain provider URLs or query parameters.
        app.logger.error(
            "Mandi endpoint failed unexpectedly: exception_type=%s",
            type(exc).__name__,
        )
        return jsonify({
            "error": "Mandi price service encountered an unexpected server error. "
                     "Please try again; no price data was returned."
        }), 500


@app.post("/api/recommend")
def recommend():
    try:
        return jsonify(recommend_crops(request.get_json(silent=True) or {}))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip()
    language = str(payload.get("language", "en"))
    if not message or len(message) > 4000:
        return jsonify({"error": "Write a question (up to 4,000 characters)."}), 400
    if language not in LANGUAGES:
        return jsonify({"error": "Choose English, Hindi or Kannada."}), 400
    try:
        answer = chat_reply(message, language)
        with db() as conn:
            conn.executemany("INSERT INTO chat_messages (role, content, language) VALUES (?, ?, ?)",
                             [("user", message, language), ("assistant", answer, language)])
        return jsonify({"answer": answer, "language": language, "disclaimer": "AI-generated general information; confirm important decisions with local agricultural experts."})
    except (ValueError, requests.RequestException) as exc:
        return jsonify({"error": str(exc) if isinstance(exc, ValueError) else "The AI service is temporarily unavailable."}), 503


@app.get("/api/history")
def history():
    with db() as conn:
        rows = conn.execute("SELECT id, role, content, language, created_at FROM chat_messages ORDER BY id DESC LIMIT 100").fetchall()
    return jsonify({"messages": [dict(row) for row in reversed(rows)]})


@app.errorhandler(500)
def server_error(_error):
    return jsonify({"error": "An unexpected server error occurred. Please try again."}), 500


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
