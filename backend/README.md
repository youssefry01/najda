# NAJDA — Backend

Spring Boot API for NAJDA. Currently a single service (`najda`) covering **authentication, users, and role-based access control**. This is the foundation the rest of the domain (incidents, dispatch, hospitals, vehicles, AI) will be built on top of — see the [root README](../README.md#current-status--roadmap) for what's built vs. planned.

## Tech stack

- **Java 21**, **Spring Boot 4.1**, built with **Maven** (wrapper included, no local Maven install needed)
- **Spring Security** — request-level auth via a custom Firebase-token filter (not Spring's OAuth2 resource server flow — see [Authentication model](#authentication-model))
- **Spring Data JPA** + **PostgreSQL** — system of record
- **Flyway** — dependency present, `db/migration` scaffolded; **no migration files written yet** (see [Known gaps](#known-gaps))
- **Spring AMQP / RabbitMQ** — dependency is present; not yet wired to any publishers/consumers
- **Firebase Admin SDK** — token verification, user provisioning, custom claims
- **springdoc-openapi** — Swagger UI, auto-generated from controllers
- **Lombok**, **spring-dotenv** (loads `.env` in dev)
- **Docker** — multi-stage `Dockerfile` for containerized runs (see [Running via Docker](#running-via-docker))

## Package structure

Organized **by feature**, not by technical layer:

```
com.najda.backend/
├── NajdaApplication.java
├── auth/               registration flows (citizen self-signup, admin-provisioned employees)
│   ├── controller/  service/  dto/
├── user/                user CRUD, profile, roles
│   ├── controller/  service/  model/  dto/  repository/  mapper/
├── audit/               AuditLog entity + repository (not yet written to anywhere — see Known gaps)
│   ├── model/  repository/
├── security/
│   ├── configuration/    SecurityConfig, FirebaseConfig, SystemRoleInitializer
│   └── filter/           FirebaseTokenAuthFilter
└── exceptions/           GlobalExceptionHandler + ApiError response shape
```

New domains (`incident/`, `dispatch/`, `hospital/`, `vehicle/`, …) should follow the same `controller/service/model/dto/repository` shape inside their own package.

## Authentication model

There's no username/password login in this backend — **Firebase is the identity provider**, Postgres is the authorization source of truth. The flow:

1. Client authenticates with Firebase (phone OTP for citizens, email/password for employees) and gets a Firebase ID token.
2. Every request carries `Authorization: Bearer <idToken>`.
3. `FirebaseTokenAuthFilter` verifies the token against the Firebase Admin SDK on **every request**. If valid, it always exposes `firebaseUid` / `firebaseEmail` / `firebasePhone` as request attributes — even if no matching `User` row exists yet (this is what lets a brand-new citizen's first registration call prove their identity before any DB row exists for them).
4. If a matching, enabled `User` row *does* exist, a full Spring Security `Authentication` is populated so `@PreAuthorize` / `@AuthenticationPrincipal` work normally.
5. Firebase **custom claims** carry the user's role for token-level convenience (e.g. Next.js middleware can read the role without an API call) — but the backend never trusts the claim for access control. `FirebaseClaimsService` is the single place that writes the claim, called right after every Postgres role write.

### Roles

Seeded on startup by `SystemRoleInitializer`:

`SUPER_ADMIN`, `ADMIN`, `DISPATCHER`, `FIRST_RESPONDER`, `CITIZEN`, `HOSPITAL_STAFF`, `AMBULANCE_CREW`, `POLICE`, `FIREFIGHTER`

The very first `SUPER_ADMIN` is bootstrapped from `SUPER_ADMIN_FIREBASE_UID` / `SUPER_ADMIN_EMAIL` env vars (create that user manually in the Firebase console first — see setup below). The initializer no-ops once a `User` row exists for that UID, so it's safe to leave the values in `.env.local` permanently.

Role-change rules worth knowing (enforced in `RoleServiceImpl`):
- A `SUPER_ADMIN` can't strip their own `SUPER_ADMIN` role (avoids locking everyone out).
- A plain `ADMIN` can't touch any `SUPER_ADMIN` account, and can't grant `SUPER_ADMIN` to anyone.

## Setup

### Prerequisites

- Java 21 (JDK)
- Docker (for RabbitMQ) — or a locally running RabbitMQ instance
- A local PostgreSQL instance with a `najda` database
- A Firebase project, with a downloaded **service account JSON** (Firebase Console → Project Settings → Service Accounts → Generate new private key)

### Steps

```bash
cd backend
cp .env.example .env
```

> There's also a `.env.local.example` in this folder — an older, slightly out-of-date duplicate missing the `HIBERNATE_DDL_AUTO` line below. Use `.env.example`; the two should probably be consolidated into one at some point.

Fill in `.env`:

```dotenv
HIBERNATE_DDL_AUTO=update   # see note below on why this matters locally

FIREBASE_SERVICE_ACCOUNT_PATH=../secrets/private-key.json   # put the downloaded JSON here
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# One-time bootstrap for the first SUPER_ADMIN:
SUPER_ADMIN_FIREBASE_UID=       # UID of a user you created manually in the Firebase console
SUPER_ADMIN_EMAIL=your-email@example.com
```

Start RabbitMQ:

```bash
docker compose up -d
```

Make sure Postgres is running locally and a `najda` database exists (dev config expects `jdbc:postgresql://localhost:5432/najda`, user/pass `postgres`/`postgres` — see `src/main/resources/application-dev.yaml` if yours differs).

Run the app:

```bash
./mvnw spring-boot:run
```

The `dev` profile is active by default (`SPRING_PROFILES_ACTIVE=dev` in `application.yaml`). Schema generation is controlled by `HIBERNATE_DDL_AUTO`, **not** hardcoded per-profile: the base config defaults it to `validate` (safe, migration-driven — the intent for when Flyway migrations actually exist), but there are no migration files yet, so `validate` will fail against an empty local database. `.env.example` sets `HIBERNATE_DDL_AUTO=update` specifically so a fresh local Postgres gets its schema auto-generated from the JPA entities. Don't remove that line until real Flyway migrations exist under `src/main/resources/db/migration` (the folder is there, currently empty).

### Running via Docker

A multi-stage `Dockerfile` is included (Maven build stage → JRE runtime stage, non-root user, health check on `/actuator/health`):

```bash
docker build -t najda-backend .
docker run -p 8080:8080 --env-file .env najda-backend
```

You'll still need Postgres and RabbitMQ reachable from the container (adjust `SPRING_DATASOURCE_URL`/`RABBITMQ_HOST` accordingly if they're not on `localhost` from the container's perspective).

### Verifying it's up

- Health check: `GET http://localhost:8080/actuator/health` (public, no auth)
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Once your bootstrap `SUPER_ADMIN` exists, get a Firebase ID token for that user from the client app and call `GET /api/auth/me` to confirm the role/claims round-trip works.

## API surface (current)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register/citizen` | valid Firebase token only (no `User` row required) | Citizen self-registration after phone-OTP sign-in |
| POST | `/api/auth/register/employee` | `ADMIN`, `SUPER_ADMIN` | Admin-provisioned account for any non-citizen role |
| GET | `/api/auth/me` | authenticated | Current user's profile |
| GET | `/api/users` | `ADMIN`, `SUPER_ADMIN` | Paginated user list, filterable by role/enabled/search |
| PATCH | `/api/users/{id}/profile` | self or `ADMIN`/`SUPER_ADMIN` | Update profile fields |
| POST | `/api/users/me/sync-email` | authenticated | Pull verified email from Firebase into Postgres |
| POST | `/api/users/{id}/admin-override-email` | `ADMIN`, `SUPER_ADMIN` | Force-set a user's email |
| POST | `/api/users/me/sync-phone` | authenticated | Pull verified phone from Firebase into Postgres |
| POST | `/api/users/{id}/admin-override-phone` | `SUPER_ADMIN` | Force-set a user's phone |
| POST | `/api/users/{id}/password-reset-link` | `ADMIN`, `SUPER_ADMIN` | Re-send Firebase password reset link |
| POST | `/api/users/{id}/disable` / `/enable` | `ADMIN`, `SUPER_ADMIN` | Suspend / reinstate an account |
| GET | `/api/roles`, `/api/roles/{id}` | `ADMIN`, `SUPER_ADMIN` | List / fetch roles |
| GET | `/api/users/{id}/role` | self or `ADMIN`/`SUPER_ADMIN` | Get a user's role |
| PATCH | `/api/users/{id}/role` | `ADMIN`, `SUPER_ADMIN` | Change a user's role |

Full request/response shapes are easiest to check live in Swagger UI rather than duplicating here — keep that as the source of truth as endpoints get added.

## Testing

```bash
./mvnw test
```

Test coverage is currently minimal (one smoke test, `DispatcherApplicationTests`). Add tests alongside new modules as they're built rather than backfilling later.

## Known gaps

Things that exist structurally but aren't finished — worth knowing so you don't assume they work:

- **`AuditLog`** — the entity and repository exist and are actually written to for **one** action: a Super Admin's phone override (`UserServiceImpl.writeAuditLog`, called from `adminOverridePhone`). Role changes, disables/enables, and email overrides don't write an entry yet, even though they're exactly the kind of action it's meant to capture — worth extending the same pattern to those as they come up.
- **Flyway** — on the classpath, and `src/main/resources/db/migration` exists, but it's empty — no migration files yet. Schema is still generated by Hibernate `ddl-auto` (see the `HIBERNATE_DDL_AUTO` note in Setup above). This needs to happen before there's any shared/staging database, since `update` can silently diverge across environments, and the base config's `validate` default is already written assuming migrations will exist.
- **RabbitMQ** — infrastructure (`docker-compose.yml`, the `spring-boot-starter-amqp` dependency) is in place, but no exchanges/queues/listeners are defined yet.
- **`prod` profile** — present in `application-prod.yaml` but unexercised; it expects `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` and `RABBITMQ_HOST/PORT/USERNAME/PASSWORD` to come from the environment. With the base config's `ddl-auto: validate` default and no override, this profile will refuse to start against a schema Flyway hasn't produced — which is correct, but means real migrations are a hard prerequisite for ever using it.

## Full spec

This README is the fast-start version. For the precise, current contract — every functional requirement (FR-1…FR-53) tagged Implemented/Planned, use case specs, business rules, and a full API reference — see [`../docs/`](<../docs/NAJDA Software Engineering Documentation.pdf>), specifically §3.1 (Identity & Access requirements), §6.1 (IAM use cases), §8 (business rules), and Appendix B (API reference).

## Future additions

_(Space intentionally left for whoever picks up the next module — add a short section here per new domain package as it lands, e.g. `## incident/`, `## dispatch/`, describing what it owns and any non-obvious decisions, the way this doc does for `auth/`/`user/`/`security/` above.)_