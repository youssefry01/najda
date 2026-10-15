# NAJDA — Backend

Spring Boot API powering every role in NAJDA: incident intake, dispatch, shift and mission lifecycle, hospital handoff, facility management, and the AI/geospatial/identity services that support them.

## Stack

- **Spring Boot** (Java) — REST API, WebSocket (STOMP over a simple in-memory broker), Spring Security, Spring Data JPA
- **PostgreSQL** — the single source of truth for everything except the auth credential itself
- **Firebase Admin SDK** — verifies ID tokens, creates and manages account credentials (employee accounts, and citizen accounts after email verification), reads live provider/verification state when needed, and backs the admin-facing Firebase↔database reconciliation tooling. The same service account sends **push notifications through Firebase Cloud Messaging** (free on the Spark plan — no Cloud Functions or paid plan involved)
- **Supabase Storage** — private bucket, accessed exclusively through short-lived signed URLs the backend mints on demand
- **OpenRouter** — free-tier LLM access for incident priority classification and duplicate-incident suggestion
- **Brevo** — transactional email over its HTTPS API (registration verification codes), behind an `EmailSender` interface so swapping providers means writing one adapter class
- **OpenStreetMap ecosystem** — Overpass API (facility seeding), Nominatim (reverse geocoding, rate-limit aware), OSRM (driving-route polylines for the live map)

## Domain model, briefly

- **Facility** — one entity, one `facilityType` (`HOSPITAL` / `AMBULANCE_STATION` / `FIRE_STATION` / `POLICE_STATION`), with a `registered` flag set automatically the moment real staff or a unit gets linked to it.
- **ResponseUnit** — a vehicle (or, for `FIRST_RESPONDER`, a person's personal unit, linked to its one owner through the unique `owner_user_id`). Ambulance and first-responder units may operate without a fixed facility; every other type requires one.
- **ShiftAssignment** — the record that a specific employee is on duty for a specific unit, as `LEAD` or `CREW`. A unit has no operational status without one. Every mission-action authorization check ultimately traces back to "is this caller the unit's active LEAD."
- **Incident → Mission → HospitalTransfer** — an incident can carry multiple concurrent missions (one per responding unit), each recording the dispatcher who assigned it (`assignedBy`); an `AMBULANCE` mission's terminal step is a `HospitalTransfer`, which carries its own state (`SELECTED` → `EN_ROUTE` → `ARRIVED`) and, while active, a running vitals log. An incident also carries a `source` (citizen app vs. a paired device — the latter modeled, not yet wired to a real integration). An incident can end **cancelled by its citizen** (a required reason category, plus text for "Other") or be **marked a false report** by dispatch (a type, who, when) — both are recorded on the incident itself. An incident also records whether its reporter allowed responders to see their medical profile (`shareMedicalProfile`) — see **Medical profile access** below — and, when the client sent one, a `clientRequestId` that makes submitting it idempotent (see **Idempotent incident submission**).
- **FirstResponderApplication** — a citizen's application to become a `FIRST_RESPONDER`, submitted as one atomic request with its required supporting documents attached (not added afterward), reviewed by an admin.
- **EmailVerification** — a short-lived record per email address going through registration: the hashed one-time code, attempt counter, resend cooldown, and — once verified — the hash of a one-time registration token. It's deleted in the same transaction that creates the account; expired rows are purged by a scheduled job.
- **UserNotification / DeviceToken** — the in-app notification inbox (one row per recipient, text stored in English *and* Arabic) and the registry of devices (Android, iOS, browser) that receive push. A token belongs to one user at a time. See **Notifications and push** below.
- **MedicalProfile** — one optional row per user, keyed by `user_id` (kept out of `User`, which is loaded on every request). Blood type, date of birth, weight, quick-pick allergies and conditions (closed enums, queryable) with explicit `noKnownAllergies` / `noKnownConditions` states plus free-text "other" notes, current medications, medical notes, up to three ordered emergency contacts (each with a relationship), and a standing `shareWithResponders` consent. Free text and contacts are encrypted at rest. Deleted with its user (`ON DELETE CASCADE`).

## API surface, by domain

| Domain | Base path | Notes |
|---|---|---|
| Health | `/api/health` | Public liveness check (`{"status":"UP"}`), touches no dependencies. For external uptime monitors |
| Status | `/api/status` | Public readiness check with per-component state (`api`, `database`, `auth`); returns 503 when a dependency is down. Result is cached for 15 seconds. Used by the web status indicator |
| Auth | `/api/auth` | Citizen email + password registration (`/register/otp/send` → `/register/otp/verify` → `/register/citizen/password`, all public), Google/phone registration bootstrap, admin-provisioned employee creation |
| Users | `/api/users` | Profile, role, facility assignment, phone/email verification, admin overrides |
| Complete profile | `PATCH /api/users/me/complete-profile` | Completes a new (Google sign-up) account in one atomic request: name, address, gender and, unless a verified number is on file, the phone. One transaction, one row lock — see the concurrency note under *A few things worth knowing* |
| Medical profile | `/api/users/me/medical-profile` | The caller's own profile: `GET` (an empty profile if none), `PUT` (full replacement), `DELETE`. There is no user id in the path — a user can only ever touch their own |
| Firebase sync | `/api/admin/firebase-sync` | Detects and resolves drift between Firebase accounts and database rows: create a database profile for a Firebase-only user, create a Firebase account for a database-only user (`POST /postgres-user/{id}/sync`), or delete either side (Super Admin only) |
| Facilities | `/api/facilities` | CRUD, OSM-backed seeding, address backfill |
| Units | `/api/units` | CRUD, location reporting, reset-to-facility (unit LEAD or admin), status reconciliation. Responses include the owning user for `FIRST_RESPONDER` units |
| Incidents | `/api/incidents` | Submission (with an optional shareMedicalProfile flag and an optional `clientRequestId` that makes a retry return the original incident; the location is validated: inside Egypt, and a manual pin only when enabled and near the device's GPS fix), queue/active views, history, injured-count edits, citizen cancellation (reason required), false-report marking (dispatcher+; clearing is admin-only), AI retry, duplicate marking/dismissal |
| Incident media | `/api/incident-media` | Signed upload flow, registration, signed download links, deletion. Evidence can be **added** while the incident is live (until resolved/cancelled); editing the original message and deleting evidence stay restricted to before assignment |
| Incident responders | `/api/incidents/{id}/responders` | Citizen-safe view of the units working an incident: type, status and live position only — no names or plates. Police positions are withheld server-side |
| Incident presence | `/api/incidents/{id}/presence` | Dispatcher heartbeat / leave / who else is viewing. Advisory only; in-memory, per instance |
| Caller history | `/api/incidents/{id}/caller-history`, `/api/admin/caller-flags` | Recent cancellation and false-report counts for an incident's caller (dispatcher+), and the admin review list. Informational — never an input to priority or assignment |
| Incident medical profile | `/api/incidents/{id}/medical-profile` | Read-only, for the people treating the patient. Returns `{ shared, profile }`. Rules and auditing are described under **Medical profile access** |
| Incident location rules | `/api/config/incident-location` | Whether a manual pin is allowed, how far it may be from the device's GPS fix, and Egypt's outline (GeoJSON). The web app reads it, so both sides apply the same rules |
| Notifications | `/api/notifications` | The caller's inbox (`GET`, newest first, keyset-paged with `before`/`limit`), `GET /unread-count`, `POST /{id}/read`, `POST /read-all`, and push-device registration (`POST /devices`, `DELETE /devices?token=`). Open to every signed-in role; a user can only ever touch their own |
| Shifts | `/api/shifts` | Start/join/leave/end, admin force-end |
| Missions | `/api/missions` | Offer, accept/reject, en-route/arrived/complete, withdraw, dispatcher cancel |
| Hospital transfers | `/api/hospital-transfers` | Recommendation, selection, status progression, vitals. Responses carry `incidentId` |
| Chat | `/api/incidents/{id}/chat` | Scoped to active participants for sending; readable by anyone who was ever a participant |
| First-responder applications | `/api/first-responder-applications` | Atomic submission with required documents, admin review |
| Support | `/api/support-messages` | Server-side rate limiting for the Support page |
| WebSocket | `/ws` | STOMP endpoint; `/topic/incidents`, `/topic/missions`, `/topic/units`, per-transfer vitals topics, plus payload-free per-incident nudges at `/topic/incidents/{id}/responders` and `/topic/incidents/{id}/presence`, and a payload-free per-user nudge at `/topic/users/{id}/notifications` whenever a notification is created |

Every mutating endpoint enforces its real authorization in the service layer via `@PreAuthorize` and explicit ownership/role checks — never assume a client-side gate is the actual boundary. `/ws`, `/api/health` and `/api/status` are intentionally permitted at the Spring Security level; a STOMP handshake carries no Bearer token the way a normal REST call does.

## Medical profile access

A medical profile is private to its owner. The only way anyone else sees it is `GET /api/incidents/{id}/medical-profile`, and only when **all** of the following hold (`IncidentMedicalProfileServiceImpl`):

| Viewer | Must also be |
|---|---|
| `DISPATCHER` | — (any open incident) |
| `AMBULANCE_CREW`, `FIRST_RESPONDER` | a participant of a mission on the incident that is `ACCEPTED`, `EN_ROUTE` or `ARRIVED`, crewing an `AMBULANCE` or `FIRST_RESPONDER` unit |
| `HOSPITAL_STAFF` | on the facility that is the destination of a hospital transfer on the incident (mission `ACCEPTED` through `COMPLETED`) |

Admins, Super Admins, fire and police crews, and other citizens are denied with a 403 (`AccessDeniedException`, mapped by `GlobalExceptionHandler`). In addition:

- **The incident must still be open** (not `RESOLVED` / `CANCELLED`).
- **The reporter must have shared it.** An incident only knows who *reported* it, and a reporter can be calling for someone else, so access is consent-based rather than automatic. `incident.shareMedicalProfile` is set at submission from the reporter's standing consent (`share_with_responders`) **and** the per-report flag in `SubmitIncidentRequest` (`null` = use my consent, `false` = reporting for someone else; `true` can never override missing consent). Older clients that send nothing keep working.
- **Consent is re-checked on every read**, so withdrawing it takes effect immediately, even for an incident that is already open. A permitted viewer then simply gets `{ "shared": false }`.

Every successful read writes a `MEDICAL_PROFILE_VIEWED` row to `audit_logs` (viewer, patient, incident id, viewer role) in the same transaction, so if the audit insert fails the read fails with it. Denied requests and `shared: false` responses are not logged. The who-may-see sets (`CLOSED_STATUSES`, `MEDICAL_UNIT_TYPES`, `TRANSFER_MISSION_STATUSES`) are constants at the top of the service — change policy there, not in callers.

## Notifications and push

Every notable moment in a response produces notifications — an inbox entry for each recipient, a live nudge for open apps, and a push to their registered devices. It is built so business code only says *what happened*; who is told and what they read is decided in one place.

**Flow.** A service calls a named method on `NotificationPublisher` (`missionOffered(mission)`, `chatMessage(incident, sender)`, …) from inside its own transaction. The publisher resolves the recipients and text parameters immediately (while lazy relations can still load) and publishes a `NotificationRequested` event. `NotificationDispatcher` handles it **after the transaction commits**, on its own small thread pool (`notificationExecutor`): it saves an inbox row per recipient, nudges `/topic/users/{id}/notifications`, and sends FCM pushes through `FcmPushSender`. A rolled-back change therefore never notifies anyone, and a slow or failing push provider can never delay or break the request that caused it.

| Moment | Told | Type |
|---|---|---|
| New incident submitted | dispatchers, admins | `INCIDENT_NEW` *(urgent)* |
| Citizen cancels | dispatchers, admins | `INCIDENT_CANCELLED_BY_CITIZEN` |
| Mission offered to a unit | its crew | `MISSION_OFFERED` *(urgent)* |
| Mission cancelled (by dispatch, or by a citizen cancellation / false-report close) | its crew | `MISSION_CANCELLED` |
| Unit rejects / withdraws | dispatchers, admins | `MISSION_REJECTED` *(urgent)* / `MISSION_WITHDRAWN` |
| Unit accepts, goes en route, arrives | the citizen | `INCIDENT_ACCEPTED` / `INCIDENT_EN_ROUTE` / `INCIDENT_ARRIVED` |
| Incident resolved, closed as duplicate, closed as false report | the citizen | `INCIDENT_RESOLVED` / `INCIDENT_CLOSED_DUPLICATE` / `INCIDENT_CLOSED_FALSE_REPORT` |
| Ambulance selects a hospital | that hospital's staff | `PATIENT_INCOMING` *(urgent)* |
| Chat message | the other side: from the citizen → live crew and dispatchers; from anyone else → the citizen | `CHAT_MESSAGE` |
| Responder application submitted / approved / rejected | admins / the applicant | `APPLICATION_SUBMITTED` / `APPLICATION_APPROVED` / `APPLICATION_REJECTED` |

Nobody is ever notified of their own action.

**Bilingual by construction.** `NotificationMessages` is the single source of wording. Each notification stores its title and body as `{"en": …, "ar": …}`; the inbox returns both, so a client shows the user's own language (and a language switch applies to old entries too), and a push is written in the language the device registered with.

**Devices.** `POST /api/notifications/devices` takes `{token, platform: ANDROID|IOS|WEB, locale}` and is an idempotent upsert — clients call it on every launch and after a language change. A token belongs to one user at a time: whoever signs in on a shared phone takes it over, and clients unregister on sign-out. A token FCM reports as `UNREGISTERED` is deleted immediately; a nightly job purges notifications and devices older than 90 days.

**Priorities.** Urgent types (new incident, mission offered, mission rejected, patient incoming) go as high-priority FCM messages with a short TTL (a mission offer is worthless after a few minutes) on the Android `najda_urgent` channel; the rest use `najda_updates`. The channel ids are a contract with the Android app, which creates them at start-up.

**Privacy.** A push never contains chat text or medical data — only that something happened and where to open it. A burst of chat messages collapses into one unread notification per incident per minute.

**Firebase setup.** Free on the Spark plan; the only requirement is the service account the backend already loads. The *Firebase Cloud Messaging API (V1)* is enabled by default on new projects; if sending logs a permission error, enable it under Google Cloud → APIs. `PUSH_ENABLED=false` turns delivery off (tests, local runs) while the inbox keeps working. Web push additionally needs a Web Push key pair and iOS needs an APNs key — both configured in the Firebase console, nothing in this repo.

**Adding a notification:** add a `NotificationType`, its English and Arabic text in `NotificationMessages`, a method on `NotificationPublisher` (who is told), and one call at the business moment. `NotificationMessagesTest` fails if a type has no text in either language.

## Idempotent incident submission

`POST /api/incidents` accepts an optional `clientRequestId` (8–64 characters: letters, digits, `-`, `_`). A client generates one random id per report and sends it with every attempt. If the first attempt reached the server but its response was lost, the retry returns the **original** incident instead of creating a duplicate or being refused with "You already have an active emergency". The mobile app's offline outbox depends on this. Uniqueness is per citizen (a partial unique index, `V2`), the replay check runs before any rule that would now reject a second submission, and a replay has no side effects (no second AI run, no second notification). If two identical requests race, the unique index rejects the loser and `IncidentController` returns the winner. Clients that send no id (the web app) are unaffected.

## Environment variables

```
# Firebase Admin SDK — path to the service account JSON key (also used to send FCM push)
FIREBASE_SERVICE_ACCOUNT_PATH=

# Database (set directly when running outside Docker; docker-compose.yml wires these itself)
SPRING_DATASOURCE_URL=
SPRING_DATASOURCE_USERNAME=
SPRING_DATASOURCE_PASSWORD=

# Supabase Storage (private bucket)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=

# OpenRouter (AI priority + duplicate detection)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-oss-20b:free   # swappable without a redeploy if the free-tier lineup shifts

# Chat / incident text / vitals notes / medical-profile free text and emergency contacts: encryption at rest
# 256-bit AES key, base64-encoded — generate once with: openssl rand -base64 32
TEXT_ENCRYPTION_KEY=

# Registration email verification (OTP)
# HMAC key for hashing one-time codes, min 32 chars — generate with: openssl rand -base64 48
# Required in prod; the dev profile has a built-in default
OTP_HMAC_SECRET=

# Transactional email (Brevo) — required in every environment; the app won't start without them
BREVO_API_KEY=            # the API key, not the SMTP key
MAIL_FROM_EMAIL=          # must be a sender you've verified in Brevo

# Incident location rules (both optional)
INCIDENT_ALLOW_MANUAL_PIN=false            # true lets a citizen fine-tune the pin; false requires the live GPS location
INCIDENT_MANUAL_PIN_MAX_RADIUS_METERS=300  # how far a manual pin may be from the device's GPS fix

# Push notifications (both optional)
PUSH_ENABLED=true                          # false: store notifications and nudge open apps, but send no FCM push
WEB_BASE_URL=https://najda-web.vercel.app  # where a web-push notification sends the user when clicked (must be https for push links)
```

## Running locally

**Via Docker (recommended):**
```bash
docker compose up backend postgres
```

**Manually:**
```bash
./mvnw spring-boot:run
```
Requires a running Postgres instance and every variable above set in your environment.

## Schema management

Managed through Flyway, versioned under `src/main/resources/db/migration/`. `V1__baseline.sql` captures the schema as it stood when migrations were introduced, generated directly from a real `pg_dump` rather than reconstructed by hand. Hibernate's `ddl-auto` is set to `validate` — it checks that the entity mappings match the real schema and fails loudly on any mismatch, but never silently alters anything again.

Every schema change from here on is a new numbered file, applied automatically and identically across every environment the next time each one starts up — no more manually running the same `ALTER TABLE` twice and hoping neither environment was missed. So far: `V2__incident_client_request_id.sql` (idempotent submission) and `V3__notifications.sql` (`notifications`, `device_tokens`). **Never edit a migration that has already run anywhere** — Flyway checksums it and the app will refuse to start; add a new numbered file instead.

## Seeding data

- **Facilities** — from the admin Facilities tab, seed by type (Hospital / Fire / Police) directly from OpenStreetMap. Ambulance stations aren't reliably tagged on OSM and are added manually.
- **Addresses** — if a seeded facility comes back with no address (a transient upstream geocoding failure), the same tab's "Fill missing addresses" action retries it. Both the seed and the backfill stop themselves cleanly the moment Nominatim rate-limits the request stream, rather than grinding through the remaining list at a rate that's already being rejected.
- **Test accounts** — `SystemUserInitializer` bootstraps one account per role on startup, each backed by a real test facility, for exercising the full workflow without manually creating every role by hand.

## A few things worth knowing before extending this

- **Never trust `IncidentMedia.url` for display** — the bucket is private; always resolve a fresh signed download URL through `/api/incident-media/{id}/download-url` (or the equivalent facility-application endpoint) rather than caching a stored link.
- **`ProfileCompletionEvaluator` is the single source of truth** for whether an account's profile is complete, including whether it has a password provider attached (checked live against Firebase, since that's not something this database stores). Don't reintroduce a second copy of this logic elsewhere.
- **Phone uniqueness is verified-only, and it's an application-layer rule, not a database constraint.** Two accounts can hold the same unverified number simultaneously; a verified number can never be claimed by a second account. Any new code path that sets a phone number needs to check `existsByPhoneAndPhoneVerifiedTrue` itself — there's no `unique=true` column catching this for you. Email + password registration does exactly this and rejects with `PhoneAlreadyInUseException` (HTTP 422).
- **Deleting an incident is intentionally destructive and `SUPER_ADMIN`-only** — it cascades through missions, chat, and hospital-transfer records, and, once the database delete commits, removes the incident's `incidents/{id}/` folder from Supabase Storage (best-effort: a storage failure is logged, never surfaced). For anything short of genuine cleanup, prefer cancelling or marking a duplicate instead.
- **The Firebase sync tool is for development convenience, not routine operation.** It exists because testing against one shared Firebase project from both a local machine and production can leave accounts on one side with no matching row on the other — it's not meant to run automatically or often.
- **Email registration creates nothing until the email is verified.** `POST /api/auth/register/otp/send` emails a 6-digit code (HMAC-SHA256 hashed at rest, 10-minute TTL, 60-second resend cooldown, 5 attempts); `/otp/verify` returns a one-time token; `/citizen/password` requires that token, then creates the Firebase user (already email-verified) and the database row in one transaction — deleting the Firebase user again if the database write fails. TTLs and limits live under `najda.auth.otp.*` in `application.yaml`.
- **Rate limiting and incident presence are in-memory, per instance.** `InMemoryRateLimiter` backs the registration endpoints, and `IncidentPresenceService` tracks which dispatchers have an incident open. In production `server.forward-headers-strategy: native` (set in `application-prod.yaml`) makes limits key on the real client IP instead of the proxy's. If the backend is ever scaled horizontally, move both to a shared store.
- **Email delivery is required, not optional.** There is no log-only dev mode: the app refuses to start without `BREVO_API_KEY` and `MAIL_FROM_EMAIL`, and the sender must be verified in Brevo. Without an authenticated sending domain, some messages will land in spam — authenticate a domain in Brevo once you have one; no code change is needed.
- **Keep `/api/health` shallow and put dependency checks in `/api/status`.** Monitors that restart or alert on a failing health check would otherwise report an outage every time the database blips. 
- **`/api/status` depends on a short database connection timeout.** `spring.datasource.hikari.connection-timeout` is set to 5000 ms in `application.yaml`. Without it, HikariCP waits 30 seconds for a connection when Postgres is unreachable, so the status endpoint would hang instead of quickly reporting `database: DOWN`. Don't raise it much, and don't go below about 3 seconds or a database waking from sleep will cause false failures.
- **Concurrency model.** Assigning a unit takes a pessimistic row lock on the unit (`findByIdForUpdate`) and re-checks it is `AVAILABLE`, so a unit can't be double-booked. Don't add `@Version` to `ResponseUnit` — GPS updates every 15 seconds would conflict with assignments. `Incident` and `Mission` use `@Version`; a lost update surfaces as HTTP 409 through `GlobalExceptionHandler`, and `assign-unit` retries once on a version conflict (two dispatchers assigning different units to a fresh incident both try to move it to `ASSIGNED`, which is harmless).
- **Presence is advisory.** "Sara is also viewing" never blocks anything, expires 45 seconds after the last heartbeat (a `@Scheduled` job prunes stale entries, so `@EnableScheduling` must be on), and uses the REST calls for identity — a STOMP connection carries no token — with the WebSocket only sending an empty nudge.
- **Citizens see a minimal view of responders.** The citizen map is fed by `/api/incidents/{id}/responders` and the per-incident topic only. Names, plates and mission details stay out of it, and `/topic/missions` (which carries full mission payloads) must never be consumed by a citizen-facing screen. `POSITION_HIDDEN_TYPES` in `MissionServiceImpl` lists the unit types whose position is never shared.
- **Caller flags are context, not verdicts, and nothing is penalised automatically.** Cancellation counts (30 days) and false-report marks (90 days) are shown to dispatchers and on an admin review list; thresholds are constants in `CallerHistoryServiceImpl`. A false-report mark is a dispatcher/admin decision (audit-logged, admin-reversible); suspending an account is a manual admin action. Never feed this data into AI priority, assignment, or rate limiting — a caller must never be blocked from asking for help by a rule.
- **Citizen cancellation stands units down.** Allowed until a unit has arrived; it cancels every offered/accepted/en-route mission (via `MissionService.cancelOpenMissionsForIncident`) and frees the units. `MissionEventPublisher.publishMissionUpdated` also nudges the per-incident topic, so any new mission mutation should publish through it.
- **Incident location rules live in one place.** `IncidentLocationPolicy` validates every submission: the coordinates must fall inside Egypt's outline (`geo/egypt-boundary.geojson`, loaded by `EgyptBoundary` and also served to the web client so both sides test the same polygon), and a `MANUAL_PIN` is accepted only when `INCIDENT_ALLOW_MANUAL_PIN` is on and the pin is within `INCIDENT_MANUAL_PIN_MAX_RADIUS_METERS` of the `deviceLatitude`/`deviceLongitude` sent with it. Violations return HTTP 422 (`InvalidLocationException`). The server can't prove a device's GPS is honest, so this stops mistakes and casual abuse, not a determined spoofer. The bundled outline is a simplified starter (exact on the straight borders, a few kilometres generous along the coast); replace the file with a Natural Earth or OSM extract for precision, with no code changes. Keep `/api/config/incident-location` returning plain maps and lists rather than a Jackson `JsonNode`, or the geometry can serialize as bean properties instead of GeoJSON.
- **Medical data conventions.** Structured fields are closed enums mirrored in `CHECK` constraints (and in the web's constants and locale files). Free text and emergency contacts use `MessageContentConverter` — AES-256-GCM with `CHAT_ENCRYPTION_KEY`, despite the name it is the project's general string-encryption converter — so those columns are `TEXT` (ciphertext is longer than plaintext) and rotating the key makes existing values unreadable. `MedicalProfile` is deliberately separate from `User`; don't surface it through `UserResponse`. `updated_at` is set explicitly in `MedicalProfileServiceImpl` because a change to only a collection doesn't dirty the row, so `@UpdateTimestamp` wouldn't fire; the web uses it for its "review your information" nudge.
- **Phone validation lives in `@EgyptianMobile`** (`com.najda.backend.validation`). Null is valid, so pair it with `@NotBlank` where a number is required. It is applied to the registration DTOs, the phone-change endpoints (`PhoneRequest`) and emergency contacts. A constraint on a DTO does nothing unless the controller parameter is also `@Valid` — check both. The web's `PhoneField` enforces the same pattern.
- **Throw `AccessDeniedException` for authorization failures in services.** `GlobalExceptionHandler` maps it to 403; without that mapping its catch-all would turn it into a 500. (Older code throws `IllegalArgumentException` for this and returns 400 — prefer 403 in new code.)
- **Firebase "sync to Firebase" recreates the account under the database row's existing UID**, so nothing in Postgres changes. The phone is attached only if `phoneVerified` is true (Firebase has no "unverified phone" state); the email starts unverified because the database doesn't track it; users with an email get a throwaway password and set their own via "Forgot password"; the `role` claim is re-synced. It refuses with a 409 rather than overwrite an existing account (same UID) or take over an email/phone another Firebase account already uses.
- **Notify through `NotificationPublisher`, from inside the transaction — never send directly.** Delivery is deliberately decoupled (after commit, off-thread, best-effort): don't call `FcmPushSender` from business code, and don't make a business operation depend on a notification succeeding. `@EnableAsync` is switched on in `NotificationConfig`; existing `*Async` method names elsewhere are not `@Async`-annotated and are unaffected.
- **`notifications.incident_id` has a real foreign key with `ON DELETE CASCADE`.** Deleting an incident (SUPER_ADMIN cleanup) removes notifications about it; without the cascade the delete would fail on the constraint, and without the FK the inbox would keep dead links.
- **Notification text is stored as JSON in `TEXT` columns** through `JsonMapConverter` (no database-specific JSON type), so it works with `ddl-auto: validate` unchanged. The inbox API returns the whole `{en, ar}` map; pick the language on the client.
- **Idempotency is per citizen, not global.** The unique index is `(citizen_id, client_request_id)` and only where the id is set, so existing rows and clients that send none are exempt. Don't reuse a request id for a *different* report.
- **Read-modify-save needs a transaction and, for contended rows, a lock.** `User` edits go through `UserRepository.findByIdForUpdate` inside `@Transactional` methods. Without that, two concurrent requests each save a whole row from their own stale copy and the later one silently erases the earlier one (this is what made the mobile "complete profile" form need two taps). Clients should still prefer one request per user action (`/me/complete-profile`) over several that touch the same row.
- **Contended entities (`User`, `ResponseUnit`, `Facility`) are `@DynamicUpdate`.** `spring.jpa.open-in-view` is on (the Boot default), so non-transactional services work on managed entities, and without `@DynamicUpdate` every `save()` rewrites *all* columns from values read earlier — two concurrent edits to different fields silently erase each other (a GPS update un-assigning a unit; a profile edit undoing an account disable). Keep the annotation on any entity that several request types write to, and use `@Transactional` + `findByIdForUpdate` when a method's *logic* depends on the row not changing underneath it.
