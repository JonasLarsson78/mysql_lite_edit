# MySQL Lite Edit

Lightweight Vue 3 + TypeScript app for quickly connecting to and inspecting MySQL databases.

Status: MVP (Minimum Viable Product) — basic functionality is implemented; stability and edge-case handling are limited.

Features

- Connect to remote MySQL databases (host, port, user, password, database).
- Run arbitrary SQL queries and view results in a compact, editable table view.
- Edit single cells in query results and persist updates back to the server.
- Open multiple result tabs and run queries per tab.
- Create and drop tables (via UI/API).
- Insert rows from a form and execute single-row inserts.
- Update rows from inline cell edits or query-driven updates.
- Lightweight client-side editing helpers in `src/composables` (cell editing, SQL modal).
- State management with Pinia (`src/stores/useDbStore.ts`) to track connections, results and UI state.
- Serverless API endpoints (under `api/`) that perform connection, query and modification actions.

Backend API (serverless endpoints)

- `api/connect` — open a connection to a MySQL server (per-request credentials).
- `api/query` — run SELECT and other read queries and return JSON results.
- `api/update` — apply row updates originating from editable cells.
- `api/insert-row` — insert a single row into a table.
- `api/create-table` — create a table from a supplied CREATE TABLE query.
- `api/drop-table` — drop a table by name.

Files of interest

- Frontend: `src/` (components, composables, stores).
- UI components: `src/components/` (CreateTableModal, DbConnectModal, InsertRowModal, ResultsView, etc.).
- Composables: `src/composables/` (small reusable logic like `useCellEditing.ts`).
- API routes: `api/` (connect, query, update, insert-row, create-table, drop-table).

Security & limitations

- This project is an example tooling app and is not hardened for production.
- Credentials are sent to the server on each request; avoid exposing this app on untrusted networks.
- No connection pooling, limited error handling and no pagination for large result sets — very large queries may be slow or memory intensive.

Running locally

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

3. Use the UI

- Click `Connect to DB`, enter your credentials and connect.
- Open a new tab to run SQL queries or use the provided modals to create tables and insert rows.

API usage (example)

POST `/api/connect` with JSON body:

```json
{
  "host": "db.example.com",
  "port": 3306,
  "user": "root",
  "password": "secret",
  "database": "mydb"
}
```

POST `/api/query` with JSON body `{ "sql": "SELECT * FROM users LIMIT 100" }` returns rows and column metadata.

Contributing

- Open an issue or send a PR. Helpful improvements: add pagination, stronger input validation, better error handling, tests and connection pooling.

License

- MIT

Live demo

- The app is deployed at: https://mysql-lite-edit.vercel.app/
