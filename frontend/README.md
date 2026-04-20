# Responza — Frontend

Standalone frontend for the Responza 311 operator console. No backend required — uses in-memory mock tickets and a fake AI classifier so you can demo the UI immediately.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## What's inside

- React 19 + Vite 7 + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- shadcn/ui components (Radix primitives)
- Framer Motion animations
- Sonner toasts

## Mock data

- `src/data/mock-tickets.ts` — seed tickets shown on load
- `src/lib/fake-triage.ts` — keyword-based classifier used by the "Simulate Call" dialog (replaces the real AI edge function)

To wire up a real backend later, swap `useTickets` (in `src/hooks/use-tickets.ts`) for your data layer and replace `fakeTriage()` with a real API call.
