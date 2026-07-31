# NAJDA — Web

Next.js dashboard for NAJDA. This is where the **Dispatcher**, **Hospital Staff**, and **Administrator** web experiences live (the Citizen and responder apps are mobile — see [`../mobile`](../mobile)).

Right now this app has the shared shell (landing page, auth, account management) and the **Admin** panel. The Dispatcher and Hospital dashboards — the actual core product surfaces — aren't built yet. See the [root README](../README.md#current-status--roadmap) for the full picture.

## Tech stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS 4**
- **TanStack Query** — server-state fetching/caching for backend API calls
- **Zustand** — client-side UI state only (see [State management](#state-management) — this is *not* the auth boundary)
- **Firebase** (client SDK + Admin SDK) — authentication
- **next-themes** — light/dark mode
- **lucide-react** / **react-icons** — icons

> ⚠️ This project pins a pre-release/breaking-changes version of Next.js (see `AGENTS.md` at the root of this folder). If something behaves differently than you expect from "normal" Next.js docs, check `node_modules/next/dist/docs/` before assuming it's a bug.

## Folder structure

```
web/
├── app/                     App Router pages
│   ├── page.tsx                 landing page
│   ├── login/  register/        auth pages
│   ├── account/                 logged-in user's own profile
│   ├── admin/                   admin panel (user management)
│   └── api/session/             route handler — issues the httpOnly session cookie
├── components/
│   ├── Auth/                    AuthGuard, RoleProtectedRoute, ProfileGate,
│   │                            CompleteProfileForm, login/register forms
│   ├── Account/  Admin/         page-specific components
│   ├── Header/  Footer/         shared chrome
│   ├── Providers/                AuthListener, QueryProvider
│   └── ui/                      logo variants etc.
├── hooks/                    TanStack Query hooks — one file per API operation
│                             (useUsers, useUpdateProfile, useSyncEmail,
│                             useSyncPhone, useToggleUserEnabled, ...).
│                             Each wraps exactly one backend endpoint.
├── lib/
│   ├── api/client.ts             authenticated fetch wrapper for the Spring Boot backend
│   ├── auth/
│   │   ├── roles.ts                  role config, role→route mapping, ADMIN_ROLES
│   │   ├── session.ts                session cookie helpers (server-only)
│   │   ├── errors.ts / error-messages.ts   Firebase error code → user-facing message
│   │   └── password-rules.ts         signup password requirements (shared by the
│   │                                  checklist UI and the actual submit gate)
│   └── firebase/                 client.ts (browser SDK) and admin.ts (server-side Admin SDK)
├── store/                    Zustand stores (auth-store, admin-users-store)
└── types/
    └── user.ts                   single `User` type — the canonical shape returned
                                   by /api/auth/me, /api/users, and every mutation
                                   that echoes a user back (profile update, role
                                   change, enable/disable, etc.)
```

## Authentication model

Two separate things are going on, deliberately:

1. **Talking to the backend directly.** `lib/api/client.ts`'s `apiFetch()` grabs a fresh Firebase ID token client-side (`user.getIdToken()`, which Firebase transparently refreshes near expiry) and sends it as `Authorization: Bearer <token>` straight to the Spring Boot API at `NEXT_PUBLIC_API_BASE_URL`. This is what every data-fetching hook in `hooks/` uses.
2. **The Next.js session cookie.** `app/api/session/route.ts` verifies an ID token server-side via the Firebase Admin SDK and issues an **httpOnly session cookie**. This cookie never leaves this app and is the actual security boundary for gating Next.js routes/middleware — it also carries the user's role as a custom claim so middleware can redirect without an extra API round-trip.

Two consequences worth knowing before touching auth code:

- `store/auth-store.ts` (Zustand) is explicitly **UI-reactivity only** — instant sign-out across tabs, showing the right name in the header, conditional rendering. It is *not* a security boundary. Don't gate a protected route purely on this store's state; use `AuthGuard`/`RoleProtectedRoute` + the session cookie instead.
- `AuthGuard` gates on Firebase auth state, and deliberately does **not** log someone out just because a backend call failed — a backend outage should degrade the page, not silently bounce an otherwise-valid session to `/login`. `RoleProtectedRoute` follows the same principle: a profile fetch that's merely pending or errored doesn't get treated as "wrong role."

### Roles

Role → default landing route mapping, plus display labels, lives in `lib/auth/roles.ts`:

| Role | Home route |
|---|---|
| `SUPER_ADMIN`, `ADMIN` | `/admin` |
| `DISPATCHER` | `/dispatch` *(not built yet)* |
| `HOSPITAL_STAFF` | `/hospital` *(not built yet)* |
| `CITIZEN`, `FIRST_RESPONDER`, `AMBULANCE_CREW`, `POLICE`, `FIREFIGHTER` | `/` (mobile-only roles — nothing web-specific for them) |

`roles.ts` is the one and only source of truth for this — role names, home routes, and display labels all live there (`ROLE_CONFIG`, `getRoleHome`, `getRoleLabel`, `ADMIN_ROLES`, `ROLE_NAMES`). Add a new role there and it's immediately available everywhere: middleware redirects, the admin role-change dropdown, the header's "go to dashboard" link.

### Profile completion

Being signed in isn't the same as being *usable*. `profileCompleted` — computed **server-side**, from field presence, never trusted from a client request — gates every authenticated page via `ProfileGate`, mounted once in `app/layout.tsx` around `{children}`.

Why this exists: email/password citizen registration collects everything up front (name, phone, address, gender), so `profileCompleted` is `true` from the first response. **Google sign-up can't** — Google only ever gives a name and a verified email, never phone/address/gender — so those accounts land with `profileCompleted: false` and get routed into `CompleteProfileForm` instead of whatever page they were headed to, until it's filled in. `Header`/`Footer` stay outside the gate so someone stuck there can still sign out.

### Email & phone verification

These work differently from each other, on purpose, and the difference is worth understanding before "fixing" either one:

- **Email** verification is mostly Firebase-native (`emailVerified` on the Firebase user) and mirrored into Postgres. Changing your email (`verifyBeforeUpdateEmail`) sends a confirmation link to the **new** address — the account keeps its **old** email, fully active, until that link is clicked. That click can happen minutes or days later, on a different device, with zero event fired back to this app — there's no webhook for it. So the app polls (`useEmailChangeWatcher` / `useEmailVerificationWatcher`) while a change is pending, and defensively re-syncs on every sign-in (`AuthListener`) as a catch-all for whenever polling isn't running.
- **Phone** has no Firebase-native "verified" flag at all — `phoneVerified` is a **Postgres-only** column. It's set `true` only when the backend receives a phone number that just came through a real, completed OTP flow (`linkWithPhoneNumber`/`updatePhoneNumber`), and reset to `false` the instant a raw, unverified edit is saved instead (`PATCH /me/phone`). Checking `firebaseAuth.currentUser.phoneNumber != null` as a "is it verified" proxy is a trap — it reflects whichever number was verified *most recently*, not necessarily the one currently showing in the UI after an unverified edit.

## Setup

### Prerequisites

- Node.js (whatever your team has standardized on — check `package.json`'s `engines` if one gets added; none is pinned yet)
- The [backend](../backend) running locally (or reachable) — this app has no functionality without it
- A Firebase project (same one the backend uses) with:
  - A **web app** registered, for the client SDK config
  - A **service account JSON**, for the Admin SDK (session cookie verification)
  - **Phone** enabled under Authentication → Sign-in method, if you're testing phone verification — without it, phone-linking calls fail with `auth/operation-not-allowed`, which looks like a code bug but isn't

### Steps

```bash
cd web
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```dotenv
# Firebase client SDK (public — shipped to the browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-only, from the service account JSON)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Your Spring Boot backend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

Run it:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Pages implemented so far

| Route | Purpose | Access |
|---|---|---|
| `/` | Landing page (product pitch, workflow overview, role list) | Public |
| `/login` | Firebase sign-in — email/password (with optional MFA) + Google | Public |
| `/register` | Citizen self-registration — email/password (all fields up front) or Google (name + email only, profile completed afterward via `CompleteProfileForm`); password must meet the visible strength checklist | Public |
| `/account` | Own profile: view/edit name, address, gender · email shown with verified/unverified badge, changeable via confirmation link · phone shown with verified/unverified badge, changeable + OTP-verifiable in place · password change (hidden entirely for Google-only accounts, which have no password credential) | Authenticated |
| `/admin` | User list: search, filter by role, verified-status icons inline next to email/phone · per-user detail: edit name/address/gender, override email or phone directly (phone override is `SUPER_ADMIN`-only, matching the backend's `@PreAuthorize`), change role, enable/disable, generate a password reset link | `ADMIN`, `SUPER_ADMIN` |

Not built yet: `/dispatch` (Dispatcher console) and `/hospital` (Hospital dashboard) — both have an empty route folder under `app/` and are referenced in `lib/auth/roles.ts` as destinations, but neither has a `page.tsx` yet.

For the precise, current contract behind these pages — every requirement tagged Implemented/Planned, use case specs, and the API reference each hook above is calling — see [`../docs/`](<../docs/NAJDA Software Engineering Documentation.pdf>), particularly §3.1 and Appendix B.

## Known gotchas

Things that look like bugs the first time you hit them, but are actually Firebase (or backend) behaving as designed:

- **The admin password reset button doesn't send an email.** `generatePasswordResetLink` (Admin SDK) only *generates* the link — it never delivers it. The admin panel displays the raw URL for manual copy/share; there's no automated email delivery wired up yet.
- **Changing someone's email to an address already used on another account silently does nothing** — no error, no email sent. Firebase does this deliberately to avoid leaking which emails have accounts (an enumeration attack otherwise). `useRequestEmailChange` checks `fetchSignInMethodsForEmail` first specifically to catch this before it looks like a silent failure — but that check and the actual send aren't atomic, so a theoretical (if very unlikely, given this is an authenticated self-service action, not a public form) race still exists.
- **`RecaptchaVerifier` throws "already been rendered in this element"** if a fresh instance is constructed against the same DOM node twice without clearing the first. `useRecaptchaVerifier` exists specifically to hold one instance per container and reuse it — don't reach for `new RecaptchaVerifier(...)` directly in a new call site.
- **An unmapped Firebase error code silently becomes "Something went wrong."** `mapFirebaseAuthError` logs (`console.warn`) any code it doesn't recognize rather than swallowing it — check the console before assuming a vague error is unfixable.

## Housekeeping

A few leftover files from earlier iterations aren't referenced from anywhere anymore — safe to delete next time you're in the area, not urgent:

- `lib/auth/role-routes.ts` (lowercase-keyed `ROLE_HOME`/`ROLE_LABEL`) — superseded by `lib/auth/roles.ts`'s `ROLE_CONFIG`. Zero imports left.
- `hooks/use-me.ts` — an earlier version of `hooks/useMe.ts`, importing the now-unused `AppUser` type instead of `types/user.ts`'s `User`. Nothing imports it by that filename.
- `types/appUser.ts` — only consumer was `use-me.ts` above; orphaned once that goes.

## Linting

```bash
npm run lint
```

<!-- ## Future additions

_(Add a short section per new page/dashboard as it's built — e.g. `## Dispatcher console`, `## Hospital dashboard` — covering what data it needs from the backend, any real-time/WebSocket wiring, and map integration choices, the way this doc covers auth and the admin panel above.)_ -->