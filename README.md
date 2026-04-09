# mkg-activity

A small **work activity log** you run locally in the browser. You capture what you did in free-form notes (with optional Markdown), organize entries by **calendar day**, label them with **tags**, and **export** a date range of notes as a PDF for sharing or archiving.

## Who it’s for

Anyone who wants a lightweight, private journal of work (or other) activities without a SaaS account: one SQLite file, one Node process, and a simple UI.

## Features

- **Day-based timeline** — Browse recent days (rolling 7 or 30 days) or pick a custom from/to range (persisted in a cookie).
- **Activities** — Create and edit entries per day; notes support Markdown rendering in the UI (sanitized HTML).
- **Tags** — Reusable labels attached to activities; useful for filtering themes or projects in the list.
- **Past days** — Adding an entry for an earlier calendar day is confirmed in the UI so dates stay intentional.
- **Export** — Download notes for a range as a PDF (`GET /api/export/notes` with `days` or `from`/`to` query parameters).

## Stack

| Layer | Technology |
| --- | --- |
| Server | Node.js 18+, Express, TypeScript |
| Database | SQLite via `better-sqlite3` (schema applied on startup) |
| HTML | Eta templates (`views/`) |
| Client | TypeScript bundled with esbuild to `public/assets/app.js` |
| Validation | Zod (API bodies and query params) |
| Markdown / safety | `marked` + `dompurify` |
| PDF export | `pdfkit` |

## Getting started

**Requirements:** Node.js 18 or newer.

```bash
npm install
```

### Development

Runs the API with `tsx watch` and rebuilds the client bundle on change:

```bash
npm run dev
```

Then open the URL printed by the server (default [http://localhost:3000](http://localhost:3000)).

### Production-style run

Builds TypeScript and the client bundle, then starts `node dist/index.js`:

```bash
npm start
```

## Configuration

Environment variables (optional; see `src/config.ts`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/activity.db` | SQLite database file path |
| `SQLITE_WAL` | enabled | Set to `0` to disable SQLite WAL mode |

Use a `.env` file in the project root if you use `dotenv` (already loaded by the app).

## Data model (high level)

- **activity** — Notes text, created/updated timestamps, and optional calendar day for grouping.
- **tag** — Unique tag names (case-insensitive).
- **activity_tag** — Many-to-many link between activities and tags.

The database file is created automatically when the app starts.

## API (overview)

REST JSON under `/api`, including:

- Calendar day buckets and activity CRUD
- Tag listing and linking to activities
- PDF export: `GET /api/export/notes?days=30` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`

For exact shapes and validation rules, see `src/routes/api/`.
