"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import { resolveAuthError } from "@/lib/auth/errors";
import { isPasswordValid } from "@/lib/auth/password-rules";
import { firebaseAuth } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api/client";
import type { Gender } from "@/types/user";
import Field from "./Field";
import GoogleIcon from "./GoogleIcon";
import LogoStacked from "../ui/LogoStacked";
import PasswordRequirements from "./PasswordRequirements";


const CITIZEN_REGISTER_PATH = "/api/auth/register/citizen";

function splitDisplayName(displayName: string | null): { firstName: string; lastName: string } {
  if (!displayName) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = displayName.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

async function establishSession(): Promise<void> {
  const idToken = await firebaseAuth.currentUser?.getIdToken(true);
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Account created, but sign-in failed. Try logging in.");
  }
}

type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  gender?: Gender | null;
  provider?: "google";
};

async function registerWithBackend(payload: RegisterPayload) {
  const path = payload.provider ? `${CITIZEN_REGISTER_PATH}?provider=${payload.provider}` : CITIZEN_REGISTER_PATH;
  await apiFetch(path, {
    method: "POST",
    body: JSON.stringify({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone ?? null,
      gender: payload.gender ?? null,
      address: payload.address ?? null,
    }),
  });
}

export default function RegisterForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(password)) {
      setError("Password doesn't meet the requirements below.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    let createdUid: string | null = null;
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      createdUid = credential.user.uid;

      // All fields present at once -> profileCompleted comes back true
      // immediately, no CompleteProfileForm needed for this path.
      await registerWithBackend({ firstName, lastName, email, phone, address, gender });

      await sendEmailVerification(credential.user).catch(() => null); // best-effort, doesn't block anything
      await establishSession();
      router.push("/");
    } catch (err) {
      if (createdUid) {
        await firebaseAuth.currentUser?.delete().catch(() => null);
      }
      setError(resolveAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    let registeredWithBackend = false;
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(firebaseAuth, provider);
      const { firstName: gFirst, lastName: gLast } = splitDisplayName(credential.user.displayName);

      // Google can't give us phone/address/gender -- profileCompleted
      // stays false, ProfileGate routes into CompleteProfileForm next.
      await registerWithBackend({
        firstName: gFirst,
        lastName: gLast,
        email: credential.user.email ?? "",
        provider: "google",
      });
      registeredWithBackend = true;

      await establishSession();
      router.push("/");
    } catch (err) {
      if (!registeredWithBackend) {
        await firebaseAuth.currentUser?.delete().catch(() => null);
      }
      setError(resolveAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <LogoStacked width={56} height={56} className="mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create a citizen account</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <form onSubmit={handleEmailPasswordSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={firstName} onChange={setFirstName} required />
              <Field label="Last name" value={lastName} onChange={setLastName} required />
            </div>
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field label="Phone number" type="tel" value={phone} onChange={setPhone} autoComplete="tel" required />
            <Field label="Address" value={address} onChange={setAddress} required />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </label>

            <div>
              <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
              <PasswordRequirements password={password} />
            </div>
            <Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" required />

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating account\u2026" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}