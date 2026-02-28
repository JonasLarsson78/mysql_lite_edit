# MySQL Lite Edit

Lightweight Vue 3 + TypeScript app for quickly connecting to and inspecting MySQL databases.

Status: MVP (Minimum Viable Product) — basic functionality is implemented, stability and edge-case handling are limited.

What it does

- Connect to remote MySQL databases (host, port, user, password, database).
- Run arbitrary SQL queries and view results in a compact table view.
- Edit single cells in query results and send updates back to the server.
- Open multiple result tabs and run queries within the active tab.

How it works (high level)

- Frontend: Vue 3 + TypeScript + Vite. UI components live under `src/components`.
- State: Pinia store at `src/stores/useDbStore.ts` tracks open results, loading state and UI flags.
- Composables: small reusable logic lives in `src/composables` (e.g. SQL modal, cell editing).
- Backend API: lightweight server endpoints under `api/` — `/api/connect`, `/api/query`, `/api/update` handle connecting, querying and updating.
- Security: credentials are sent to the server for each request; this project is an example tool and not hardened for production use.

Running locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. The UI exposes a `Connect to DB` dialog — fill in connection credentials and click Connect. After connecting you can open tabs, run SQL and edit cells.

Notes & limitations (MVP)

- No connection pooling, limited error handling and no advanced security features.
- Credentials are used client→server for each request; treat this as a local tool or run behind a trusted network.
- Performance: large result sets are not paginated — queries returning many rows may be slow.

Contributing

- Open an issue or send a PR. Recommended changes: improve validation, add pagination, and add better error handling and tests.

License

- MIT

Live demo

- The app is deployed at: https://mysql-lite-edit.vercel.app/
