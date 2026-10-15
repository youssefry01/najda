<div align="center">

# NAJDA

**Network for AI-powered Joint Dispatch and Assistance**

An emergency dispatch coordination platform that models how a citizen's report becomes a synchronized, multi-party response — connecting citizens, dispatchers, ambulance crews, police, firefighters, hospitals, and administrators around a single shared incident timeline.

*Not a real emergency service. Not connected to any government emergency system.*

</div>

---

## What this is

Most dispatch demos are a single dashboard pretending to coordinate things. NAJDA actually does: a citizen's report goes through AI-assisted triage, gets assigned to a unit that's genuinely on shift for it, gets tracked live on a map with real driving routes, and — for medical calls — flows through a full hospital handoff with a live vitals log. Every role sees the same incident, scoped to exactly what their job requires, in either English or Arabic — and every role is *told* when something needs them, on the web and on their phone.

## The seven roles, one incident

| Role | Surface | How they get an account |
|---|---|---|
| **Citizen** | `/emergency` (web) · mobile app | Self-registers (email + password with a one-time code sent to verify the email address, or Google) |
| **Dispatcher** | `/dispatch` | Admin-provisioned |
| **Ambulance Crew · Police · Firefighter · First Responder** | `/responder` (web) · mobile app | Admin-provisioned, or approved from a citizen's application |
| **Hospital Staff** | `/hospital` | Admin-provisioned, linked to a facility |
| **Admin · Super Admin** | `/admin` | Admin-provisioned (only a Super Admin can create another) |

Citizen and Responder also have a native mobile app — see [Mobile](#mobile) below. Desk roles can sign in to the app too (account, settings, notifications), but their consoles live on the web.

## How the pieces fit together

```
┌──────────────┐        ┌───────────────────┐        ┌──────────────┐
│   Next.js     │◄──────►│   Spring Boot API  │◄──────►│  PostgreSQL   │
│   (web)       │  REST  │   (backend)        │  JPA   │               │
└──────┬────────┘  + WS  └──┬───────┬─────────┘        └──────────────┘
       │                    │       ▲
┌──────┴────────┐  REST     │       │ REST + WS
│  Flutter app   │◄─────────┼───────┘
│  (Citizen +    │          │
│   Responder)   │          ├──► Firebase Admin SDK (identity, account sync tooling, FCM push)
└──────┬─────────┘          ├──► Supabase Storage (private, signed URLs)
       │                    ├──► OpenRouter (AI priority + duplicate suggestion)
       │                    ├──► Brevo (transactional email — registration OTP codes)
       │                    └──► OSM / Nominatim / OSRM (facilities, geocoding, routing)
       │
       └──► Firebase Auth + Cloud Messaging (client identity, push), MapLibre (maps)
            (web also: EmailJS for support)
```

- **Firebase is identity and push delivery.** Email + password (with a one-time-code-verified email), Google, and admin-issued password flows all converge on the same account model — Postgres is the single source of truth for roles, permissions, and everything that's actually happened. A citizen registering with email never gets a Firebase account or a database row until they've proven they control the address with a one-time code, closing off account-squatting entirely for that path. Push notifications ride on Firebase Cloud Messaging, which is free on the Spark plan: the backend sends through the Admin SDK it already has, so no Cloud Functions or paid plan are involved.
- **Facilities are unified.** Hospitals, fire stations, police stations, and ambulance stations are one `Facility` entity with a `facilityType` column — a `registered` flag (auto-set the moment real staff or a unit is linked) distinguishes staffed locations from geographic data points pulled in from OpenStreetMap.
- **Shifts gate everything.** A response unit can't receive a mission unless someone is actively on shift for it as `LEAD` — the direct implementation of "a vehicle isn't a driver," carried through every authorization check on missions and hospital transfers.
- **Live by default.** WebSocket push keeps every open console and app in sync with incident, mission, unit, and notification state — screens react to what changed instead of polling for it.
- **AI recommends, humans decide.** Priority scoring and duplicate-incident suggestions are both advisory, both dismissible, and neither one ever assigns anything on its own.

## Notifications

Every notable moment in a response notifies the people it concerns, in their own language (English or Arabic), through two channels that share one source of truth:

- **In-app inbox** — a bell on the web, a screen in the app: live, paged, with read/unread state; tapping an entry opens what it is about.
- **Push** — to the user's registered phones and browsers via Firebase Cloud Messaging, even when NAJDA is closed. Urgent moments (a new incident for dispatch, a mission offer for a crew, an ambulance heading to a hospital) are sent as high-priority alerts.

A few examples: dispatch hears about a new incident the moment it is filed and when a unit turns a mission down; a crew's phone rings when a mission is offered; the citizen is told when a unit accepts, is on the way, has arrived, and when the report is closed; a hospital is told an ambulance is bringing a patient; an applicant learns the outcome of a responder application; chat messages reach the other side. Nobody is notified of their own action, and a push never carries chat text or medical details. The full matrix and the design (sent after the database commit, off the request thread, best-effort by design) are in [backend/README.md](backend/README.md).

Push is opt-in per device: a switch in the web bell/inbox and in the app's Settings registers or unregisters that device, and signing out unregisters it so a shared phone never shows the next person someone else's alerts.

## Security & privacy, concretely

- Chat content, incident descriptions, and clinical notes are encrypted at rest (AES-256-GCM, application-level) — a database dump doesn't hand over plaintext.
- All media (photos, video, audio, application documents) lives in a **private** storage bucket. Nothing is ever served from a public URL — every view goes through a short-lived, authorization-checked signed link generated on demand.
- Phone numbers are unique only once *verified* — two people can hold the same unverified number simultaneously without either being locked out, but a verified number can never be claimed by a second account. Enforced entirely in the application layer, deliberately not as a blanket database constraint.
- Registration email codes are single-use proofs, not passwords: stored only as keyed hashes (HMAC-SHA256), short-lived, locked after a handful of wrong guesses, rate-limited per address and per IP, and bound to a one-time token so only the browser that verified the email can finish creating the account.
- A citizen's medical profile is private to its owner. It reaches responders only for an open incident, only if the reporter allowed it for that report, only for the roles and crews treating the patient — and every read is audit-logged.
- Incident locations are validated server-side against Egypt's outline, and a manually placed pin is only accepted within a small radius of the device's own GPS fix — the web and mobile clients read the same rules from the backend.
- Submitting an incident is idempotent: a client can retry a report whose response was lost (the mobile app's offline outbox does exactly this) without ever creating a duplicate.
- Every real permission check lives in the backend service layer, enforced independently of anything the frontend does — client-side role gating exists purely for a responsive UI, never as the actual security boundary.
- An admin-only reconciliation tool detects and resolves drift between Firebase accounts and database rows — genuinely useful when developing against one shared Firebase project across local and production environments.

## Language

Full English and Arabic support, including right-to-left layout, switchable at any point from the header (web) or Settings (mobile) — no separate URL per language on the web, since this is an authenticated tool rather than a publicly indexed site. Notifications are written in both languages by the backend, so a language switch applies to old notifications too.

## Mobile

A native Flutter app covers the two roles that work from the field — **Citizen** (report, track) and **Responder** (shift, missions) — talking to the same backend and Firebase project as web. Dispatcher, Hospital Staff, and Admin remain desk-only, served by the web console.

What it adds beyond the web experience: an **offline-first emergency report** (the form and its photos, videos and recordings are saved as you type, and a report sent without a connection is stored on the phone and delivered automatically — without duplicates — when it returns), location rules matching the backend's, full-screen playback of attached evidence, the optional **medical profile** (with a one-time prompt after registering), push notifications with in-app banners, optional **biometric unlock**, and a compact status indicator when the backend is slow or unreachable.

Android APK available now; iOS coming (it needs an Apple Developer account and an APNs key for push).

[Download the app](https://github.com/youssefry01/najda/releases/latest) · [mobile/README.md](mobile/README.md)

## Repository structure

```
najda/
├── backend/     Spring Boot API — see backend/README.md
├── web/         Next.js console for every role — see web/README.md
├── mobile/      Flutter companion app (Citizen + Responder) — see mobile/README.md
├── docker-compose.yml   Full local stack: Postgres + backend + web
└── ...
```

Registration sends real verification emails, so set up a Brevo account and sender first — see `backend/README.md` for the variables. Push notifications need nothing extra on the backend beyond the Firebase service account it already uses; the web app additionally needs a Web Push key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`) and the mobile app a registered Android app id (`FIREBASE_ANDROID_APP_ID`) — see the respective READMEs.

## Running it

The fastest path to a working local stack:

```bash
cp backend/.env.example backend/.env   # fill in real values
cp web/.env.example web/.env
docker compose up
```

See `backend/README.md`, `web/README.md` and `mobile/README.md` for the full environment variable reference, manual (non-Docker) setup, and what each external service is used for.
