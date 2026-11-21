# Fieldwise — Multilingual Agritech & Resource Advisory Assistant

Fieldwise is a beginner-friendly React and Flask application for practical farm planning. It brings together live weather, official mandi records, broad soil-based crop suggestions, and an AI assistant that can reply in English, Hindi, or Kannada. It does not estimate prices, promise yields, or replace local agricultural experts.

## Project structure

```text
project7/
├── backend/
│   ├── app.py                 Flask API and SQLite operations
│   ├── requirements.txt       Backend dependencies
│   └── Procfile               Render web service command
├── frontend/
│   ├── src/                   React screens and responsive styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js         Local /api proxy to Flask
├── .env.example
└── spec.sheet
```

## Requirements

- Python 3.10 or later
- Node.js 20 or later and npm
- API keys for the integrations you want to enable. The app itself starts without keys; those services show a clear unavailable message until configured.

## Configure API keys

Copy `.env.example` to `.env` in the repository root and add keys:

```env
GROQ_API_KEY=your_groq_key
OPENWEATHER_API_KEY=your_openweather_key
DATA_GOV_IN_API_KEY=your_data_gov_in_key
```

- **Groq:** create an API key in the Groq console. The default model is set by `GROQ_MODEL` (`openai/gpt-oss-20b`). Change it to an active model enabled for your account if needed; available model IDs can change over time.
- **Weather:** create an OpenWeather API key. Weather uses its 5 day / 3 hour forecast endpoint and shows the source. Provider access and newly created keys may take time to activate.
- **Mandi prices:** obtain an API key from data.gov.in. `AGMARKNET_RESOURCE_ID` defaults to the commonly published Agmarknet daily price resource. If the dataset resource changes or a different approved dataset is needed, set its resource ID in `.env`. The service displays the source and each record's arrival date, and never fills missing data with sample prices.

The backend reads `.env` from the repository root. Never commit real keys. SQLite is created automatically at `backend/agritech.db`; change `DATABASE_PATH` if needed.

## Run locally

Run each service in its own terminal, from the project root.

### 1. Backend (Flask)

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r backend\requirements.txt
py backend\app.py
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python backend/app.py
```

The API runs at `http://localhost:5000`. Check `http://localhost:5000/api/health` to confirm it is running. SQLite tables are initialized at startup.

### 2. Frontend (Vite + React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Vite forwards `/api` requests to Flask at port 5000. To use a separately hosted backend, set `VITE_API_BASE` to its base URL before building and add the frontend origin to the backend's comma-separated `FRONTEND_ORIGIN` setting.

Build the production frontend with `npm run build` from `frontend/`; preview with `npm run preview`.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service health |
| GET | `/api/dashboard` | Welcome, saved location, activity counts, and configured-service status |
| POST | `/api/weather` | Actual OpenWeather forecast by location; saves the last location |
| POST | `/api/mandi` | Agmarknet/data.gov.in prices by crop and optional state |
| POST | `/api/recommend` | Soil input validation and broad crop suggestions; records the soil check |
| POST | `/api/chat` | Groq response in the selected language; stores user and assistant messages |
| GET | `/api/history` | Recent stored chat messages |

## Data and safety notes

- Weather and mandi prices only appear when the source API returns usable data. Missing keys, upstream errors, and empty results have explicit messages.
- Mandi values include the market, min/max/modal rates, source and source arrival date when supplied.
- Crop matches and planting, harvest, and crop-protection notes are broad rule-based guidance. They are not guaranteed outcomes; confirm choices with local extension services and a soil test.
- Groq responses are labeled as AI-generated general information. The assistant is instructed not to invent live weather or price data or guarantee yield and profit.
- Chat history, soil checks, and the preferred location are stored locally in SQLite. Do not expose the development Flask server directly to the public internet.
- Voice input and spoken responses use the browser's Web Speech APIs. Recognition support and available Kannada/Hindi speech voices depend on the browser and device; text remains available as a fallback.

## Deploying on Render

The root `render.yaml` defines two connected Render services: a Flask web service and a Vite static site. It wires the public API URL into the frontend build and the frontend origin into Flask CORS. The API uses a persistent disk for SQLite; Render persistent disks require a paid web-service plan and keep the API to one instance.

1. Push this existing project to a Git provider supported by Render. Do not include `.env`; `.gitignore` excludes it and other local `.env.*` files while allowing `.env.example`.
2. In Render, choose **New → Blueprint**, connect the repository, and select its root directory (the folder containing `render.yaml`). Review the two services before applying them.
3. During Blueprint setup, provide `OPENWEATHER_API_KEY`, `DATA_GOV_IN_API_KEY`, and `GROQ_API_KEY` as secret environment values when prompted. Keep them in Render's Environment settings; never put real values in `render.yaml` or source files. `GROQ_MODEL` and `AGMARKNET_RESOURCE_ID` have non-secret defaults in the Blueprint and can be changed in the dashboard if required.
4. Apply the Blueprint and wait for both services to finish building. The frontend obtains the backend's public HTTPS URL at build time; Flask's CORS allowlist obtains the static site's public origin.
5. Open the `fieldwise-frontend` URL. Check `https://<backend-host>/api/health` for the API health response, then try Weather and Mandi Prices. Mandi displays only data returned by the official data.gov.in Agmarknet API; if that service times out or the key is unavailable, no prices are shown.

For manual setup instead, use a Render Web Service rooted at `backend` (`pip install -r requirements.txt`; `gunicorn app:app --bind 0.0.0.0:$PORT`) and a Static Site rooted at `frontend` (`npm ci && npm run build`; publish `dist`). Set the backend's `DATABASE_PATH` to a path on its persistent disk, set `FRONTEND_ORIGIN` to the static site's exact HTTPS origin, and set the frontend build variable `VITE_API_BASE` to the backend's HTTPS base URL. Redeploy the static site after changing `VITE_API_BASE` because Vite embeds it during the build.

## Troubleshooting

- **Service unavailable:** verify the corresponding API key in root `.env`, key access/quota, and the backend terminal output.
- **Frontend cannot reach API:** start Flask on port 5000; for separate hosts, configure `VITE_API_BASE` and `FRONTEND_ORIGIN`.
- **No mandi records:** try an official commodity spelling, optionally add a state, and verify the data.gov.in key and resource ID.
- **Voice button unavailable:** use a browser that implements Web Speech recognition. Browser permission may be required, and text input works regardless.
