# EAJ Support — Advanced Ticketing System

A polished, futuristic support platform for **EAJ** — customers submit tickets, an internal team accepts and chats with them in real time (with image sharing), collaborates via @mentions and internal notes, and resolves them. Every stage is tracked: **who requested, who accepted, who solved, and how long each took.**

Built with **Laravel 12 (API) + React SPA**, real-time via **Laravel Reverb**, and a navy→crimson glassmorphism design system.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Laravel 12, Sanctum (token auth), Reverb (WebSockets), MySQL |
| Frontend | React 19 + Vite, React Router, TanStack Query, Tailwind v4, shadcn-style UI (Radix), Framer Motion, Lucide, Recharts |
| Real-time | Laravel Reverb + Laravel Echo (Pusher protocol) |

---

## Prerequisites

- PHP 8.2+, Composer
- Node 18+ and npm
- MySQL running with a database named `db_eaj_ticketing` (see `.env`)

---

## Setup

```bash
# 1. Install dependencies
composer install
npm install

# 2. Environment (already configured for local MySQL + Reverb)
#    Ensure DB_DATABASE=db_eaj_ticketing exists, then:
php artisan key:generate        # if APP_KEY is empty

# 3. Migrate + seed demo data
php artisan migrate:fresh --seed

# 4. Link storage (for avatars & attachments)
php artisan storage:link
```

### Demo accounts (password: `password`)

| Role | Email |
|------|-------|
| Admin | `admin@eaj.test` |
| Agent | `marco@eaj.test`, `lena@eaj.test` |
| Client | `jomar@store.test`, `grace@store.test` |

---

## Running

The whole app is served by **Laravel on a single origin (`:8000`)** — Laravel renders a Blade shell that mounts the React SPA, and the client-side router handles all pages. Vite only serves the JS/CSS assets (with HMR in dev).

**Option A — full dev stack, one command** (server + queue + reverb + logs + vite, with hot reload):

```bash
composer dev
```

**Option B — separate terminals:**

```bash
php artisan serve            # App + API  -> http://localhost:8000
php artisan reverb:start     # WebSockets -> ws://localhost:8080  (needed for live chat)
php artisan queue:listen     # (optional) real-time notification toasts
npm run dev                  # Vite asset/HMR server
```

**Then open http://localhost:8000.**

> If you only run `php artisan serve` (no `npm run dev`), the app is served from the last
> `npm run build`. Run `npm run build` after pulling changes, or use `composer dev` for HMR.
> Real-time chat/status broadcast synchronously — you just need `reverb:start` running.
> The `queue:listen` process is only for real-time **notification toasts**; the in-app
> notification bell still updates on load without it.

---

## Production

```bash
npm run build     # emits hashed assets + manifest to public/build
```

Point your web server (nginx/Apache) at `public/` as usual — Laravel serves both the API and the SPA shell from one origin. Set the `VITE_REVERB_*` and app host env vars, run `php artisan reverb:start` (e.g. under Supervisor) for WebSockets, and cache config/routes (`php artisan optimize`).

---

## Feature map

- **Roles** — customer, agent, admin (server-enforced policies + `role` middleware).
- **Ticket lifecycle** — `open -> accepted -> resolved -> closed`, plus `reopened`. Timestamps drive computed **response** and **resolution** times.
- **Real-time chat** — per-ticket private **presence channel**; typing indicators; drag/drop & paste **image + file** attachments rendered inline.
- **@Mentions** — team-only, restricted to assignees on the ticket, enforced server-side; creates notifications.
- **Internal notes** — team-only messages the customer never sees.
- **Collaborators** — any assignee/admin can add/remove other team members (never customers).
- **Public team profiles** — clients can view agent bios + lightweight stats.
- **Admin** — rich "Add Client" & "Add Team Member" forms (temp password generation), lookup CRUD (system types / categories / urgency), user & role management, and an **advanced analytics dashboard** (KPIs, tickets-over-time, by system/urgency/category/status, agent leaderboard, SLA %, CSV export).
- **Icon-only actions** everywhere, each wrapped in an on-brand tooltip; destructive actions confirm via AlertDialog.

---

## API

RESTful under `/api/v1` (JSON, Bearer token). Key groups: `auth/*`, `me`, `tickets/*` (+ `accept`/`resolve`/`reopen`/`assignees`/`messages`/`typing`/`mentionable`), `notifications/*`, `team`, `users/{id}/profile`, and `admin/*` (clients, team, lookups, users, analytics). Run `php artisan route:list --path=api` for the full list.

---

## Design system

Navy surfaces (`#0A142E`–`#1D3060`), crimson accent (`#E91E4F`), dark-first with glassmorphism, soft glows, and Framer Motion micro-interactions. Tokens live in `resources/css/app.css` (Tailwind v4 `@theme`) and map to shadcn-style semantic variables so every component is on-brand.
