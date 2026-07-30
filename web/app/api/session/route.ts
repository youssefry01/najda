export const runtime = 'nodejs'; 
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken;

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (err) {

    return NextResponse.json(
      {
        error: "Invalid or expired credential",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 401 }
    );
  }

  const role = decoded.role as string | undefined;

  if (!role) {
    const signInProvider = decoded.firebase?.sign_in_provider;

    if (signInProvider === "google.com") {
      // signInWithPopup auto-creates a Firebase user on first Google
      // sign-in — that's Firebase's behavior, not ours. Since Google is
      // login-only here (never registration), undo that creation rather
      // than leave a Firebase user with no matching Postgres row.
      await adminAuth.deleteUser(decoded.uid).catch(() => null);
      return NextResponse.json(
        {
          error:
            "No account found for this Google account. Citizens can register below; staff accounts are created by an administrator.",
        },
        { status: 404 }
      );
    }

    // Email/password with no role yet is a normal transient state (e.g. a
    // staff account created by an admin who hasn't assigned a role). Don't
    // delete anything here.
    return NextResponse.json(
      { error: "This account has no role assigned yet. Contact an administrator." },
      { status: 403 }
    );
  }

  const sessionCookie = await createSessionCookie(idToken);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true, role });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}