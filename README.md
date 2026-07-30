# NAJDA

**Network for AI-powered Joint Dispatch and Assistance**

NAJDA is a simulation and decision-support platform for emergency dispatch: it models how a citizen's incident report becomes a coordinated response across dispatchers, ambulance/fire/police crews, and hospitals — with an AI service assisting (never replacing) the human dispatcher's decisions.

It's the codebase for our Computer Engineering graduation project (Modern Academy, Faculty of Engineering — Dept. of Computer Engineering). The full thesis, with the formal problem statement, requirements analysis, and system design, lives in [`book/`](./book).

> 🚧 **Status: early development.** The backend has authentication, role management, and admin user-management working end to end. The web dashboard has auth, account management, and an admin panel. Everything incident/dispatch/hospital/AI-related — the actual core of the product — is not built yet. See [Current status](#current-status--roadmap) below.

---

## Table of contents

- [Why NAJDA](#why-najda)
- [Actors](#actors)
- [Repo layout](#repo-layout)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Current status / roadmap](#current-status--roadmap)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Why NAJDA

Most student projects in this space either oversimplify emergency dispatch into a basic ticket-tracking CRUD app, or try to replicate a real national emergency system — which runs into legal/operational walls that make it impossible to demo academically.

NAJDA aims for the middle ground: a **realistic, event-driven, microservice-style simulation** of the actual workflow — report → triage → dispatch → resolve — built on the same architectural patterns a real system would use (async service-to-service communication, real-time WebSocket updates, role-scoped views of a shared incident record, AI-assisted-but-human-decided triage), without pretending to be a production 911 system.

## Actors

Every incident is one shared record; each actor only ever sees the slice of it their role permits.

| Actor | Role name(s) | Surface |
|---|---|---|
| Citizen | `CITIZEN` | Mobile app — report an incident, track response, chat with dispatcher |
| Dispatcher | `DISPATCHER` | Web dashboard — triage queue, live map, assign units |
| Ambulance Crew | `AMBULANCE_CREW` | Mobile app — accept mission, navigate, patient assessment, hospital handover |
| Firefighter | `FIREFIGHTER` | Mobile app — re-skin of the Ambulance Crew flow |
| Police | `POLICE` | Mobile app — re-skin of the Ambulance Crew flow |
| Hospital Staff | `HOSPITAL_STAFF` | Web dashboard — incoming patient prep, capacity |
| Administrator | `ADMIN`, `SUPER_ADMIN` | Web dashboard — user/vehicle/station CRUD, audit logs |

(`FIRST_RESPONDER` also exists as a role in the backend seed data as a generic fallback/placeholder role.)

## Repo layout

```
najda/
├── backend/    Spring Boot API (Java 21) — auth, users, roles, (future: incidents, dispatch, hospitals)
├── web/        Next.js dashboard — dispatcher / hospital / admin web surfaces
├── mobile/     Citizen & responder apps — not started yet
├── book/       Graduation project thesis (LaTeX source + compiled PDF) — academic writeup
└── docs/       Software Engineering Documentation — the authoritative day-to-day spec (see below)
```

Each app has its own README with setup instructions:

- [`backend/README.md`](./backend/README.md)
- [`web/README.md`](./web/README.md)

## Architecture

The target architecture (per the thesis, [`book/chapters/chapter4_system_design.tex`](./book/chapters/chapter4_system_design.tex)) is an **event-driven microservice architecture**:

- Independent Spring Boot services, each owning one business capability, communicating asynchronously over **RabbitMQ**.
- **PostgreSQL** as the relational system of record; **Redis** (planned) for caching fast-changing live location data.
- **WebSockets** pushing live updates (vehicle position, incident state changes) to connected dashboards/apps.
- **Firebase** for authentication, file storage, and push notifications — so engineering effort stays on the domain logic instead of commodity infrastructure.
- A separate **AI service** (planned) that predicts incident priority, flags duplicate reports, and recommends units/hospitals — strictly advisory; a dispatcher always makes the final call.

**Where we actually are right now:** the backend is a single Spring Boot application (`najda`) covering auth/users/roles — it hasn't been split into multiple services yet, and RabbitMQ/WebSocket/AI pieces aren't wired up. Think of the current codebase as "service #1 of the eventual set," not yet the full distributed system described above.

See [`docs/diagrams/architecture/architecture.png`](./docs/diagrams/architecture/architecture.png) for the deployed-vs-target picture side by side.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 4, Spring Security, Spring Data JPA, Flyway, Spring AMQP (RabbitMQ), springdoc-openapi |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand |
| Mobile (planned) | Flutter, cross-platform Android/iOS |
| Database | PostgreSQL (system of record), Redis (planned, live-location cache) |
| Messaging | RabbitMQ |
| Auth | Firebase Authentication (ID tokens verified server-side; Postgres is the source of truth for authorization) |
| AI (planned) | Priority classification, duplicate detection, hospital ranking, hazard image classification |

## Current status / roadmap

This list is a quick-glance summary — the [Software Engineering Documentation](./docs) tracks it precisely, requirement by requirement (FR-1 … FR-53), with a full traceability matrix linking each one to the exact class/endpoint that satisfies it (or the service planned to).

**Built:**
- [x] Firebase-token-based authentication, verified on every backend request
- [x] Role-based access control (9 seeded roles, `SUPER_ADMIN` bootstrap on first run)
- [x] Citizen self-registration, both paths — Google (profile starts incomplete) and email/password (profile complete immediately)
- [x] Admin-provisioned employee registration, with `SUPER_ADMIN`-only super-admin creation and Firebase-account rollback on failure
- [x] Profile-completeness tracking (`profileCompleted`), phone verification via OTP (`phoneVerified`) — including from the web account page — and email verification mirrored from Firebase
- [x] User search/filter/pagination, enable/disable, role changes, admin email/phone overrides (phone override is audit-logged)
- [x] Self-service and admin-generated password reset flows
- [x] Web: landing page, login/register, account page (profile, email, phone+OTP, password), admin user-management panel
- [x] Backend containerized (multi-stage `Dockerfile`, health check on `/actuator/health`)

**Scaffolded but not wired up yet:**
- [ ] Flyway (`db/migration` folder exists, no migration files yet — schema is still driven by Hibernate `ddl-auto`)
- [ ] Audit logging (`audit_logs` table + repository exist and are written to for one action — Super Admin phone override — not yet for role changes, disable/enable, or email overrides)
- [ ] `/dispatch` and `/hospital` web routes (empty route folders exist; no pages yet)

**Not built yet:**
- [ ] Incident reporting & lifecycle (create, triage, state machine)
- [ ] Dispatcher dashboard (queue, live map, unit assignment)
- [ ] Vehicle / station / hospital domain models
- [ ] Hospital staff dashboard
- [ ] First Responder certification application/review flow
- [ ] Field-role availability status (Available/Busy/Offline)
- [ ] Mobile apps (Citizen, Ambulance Crew, Firefighter, Police) — Flutter, not started
- [ ] RabbitMQ event flows between services
- [ ] WebSocket live-update channel
- [ ] AI service (priority scoring, duplicate detection, hospital recommendation, hazard classification)
- [ ] Splitting the backend into actual separate microservices

## Getting started

1. Clone the repo.
2. Set up the backend — see [`backend/README.md`](./backend/README.md) (needs a local Postgres DB, RabbitMQ via Docker, and a Firebase service account).
3. Set up the web app — see [`web/README.md`](./web/README.md) (needs Firebase client + admin credentials, and the backend running).
4. Mobile setup instructions will land here once that app exists.

## Documentation

There are two documents, serving different purposes — don't confuse them:

- **[`docs/`](./docs) — the living engineering spec.** [`docs/NAJDA Software Engineering Documentation.pdf`](<./docs/NAJDA Software Engineering Documentation.pdf>) is the authoritative, up-to-date reference: numbered functional requirements (FR-1…FR-53) and non-functional requirements, user stories, use case specs (UC-1…UC-11), business rules, a full requirements traceability matrix (requirement → user story → use case → exact class/endpoint), an API reference, and a glossary. Every requirement is tagged **Implemented** or **Planned**, and it's meant to be updated alongside the code — this is the doc to check when you need the precise, current contract for something. See [`docs/README.md`](./docs/README.md) for how the folder (diagrams, PlantUML source, the doc itself) is organized.
- **[`book/`](./book) — the graduation thesis.** Problem statement, literature review, and the academic writeup this project is submitted as. Useful for the "why," and for chapters (like system design) that mirror `docs/`, but it's a point-in-time academic document, not something updated every sprint — `docs/` is the one to trust if the two ever disagree.
- Earlier design-exploration docs (from when the project was named "RapidAid") describing the intended mobile and web screen-by-screen UX flows are useful background reading for the product-design thinking behind the current build, even though some framework choices mentioned there (e.g. React Native) have since been superseded by decisions in `docs/`/`book/` (Flutter).

## Contributing

This is an academic team project (see the author list in `book/frontmatter`). If you're on the team:

- Keep the backend and web READMEs current as modules land — they're meant to be the fast path for a teammate to get running locally, not just installation instructions.
- Domain code in the backend is organized **by feature**, not by layer (`auth/`, `user/`, `audit/`, `security/` — each with its own `controller/service/model/dto/repository`). New domains (`incident/`, `dispatch/`, `hospital/`, `vehicle/`, …) should follow the same pattern.
- Update the "Current status / roadmap" checklist above as things move from planned → built.