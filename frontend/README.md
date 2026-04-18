# DiFrontuna Frontend

Operator dashboard: shows live + past calls, transcript, detected language, urgency, structured summary, and routing decision.

## Suggested stack
- Vite + React + TypeScript
- TailwindCSS
- Fetches REST from backend (`VITE_API_BASE`) and subscribes to `ws/calls` for live updates.

Feel free to swap to Next.js if preferred — the `src/` layout stays similar.

## Run
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Layout
- `src/pages/` — top-level views (Dashboard, CallDetail)
- `src/components/` — reusable UI pieces
- `src/lib/api.ts` — backend fetch/ws client
- `src/types/call.ts` — mirrors `backend/app/models/schemas.py`
