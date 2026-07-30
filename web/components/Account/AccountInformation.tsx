"use client";

import { useState, useEffect } from "react";
import { FaRegEdit } from "react-icons/fa";
import { Check, Eye, EyeOff } from "lucide-react"
import { firebaseAuth } from "@/lib/firebase/client";
import { useUpdateProfile } from "@/hooks/useUpdateProfile";
import { useChangePassword } from "@/hooks/useChangePassword";
import { useRequestEmailChange } from "@/hooks/useRequestEmailChange";
import { useEmailChangeWatcher } from "@/hooks/useEmailChangeWatcher";
import { useResendEmailVerification } from "@/hooks/useResendEmailVerification";
import { useEmailVerificationWatcher } from "@/hooks/useEmailVerificationWatcher";
import { resolveAuthError } from "@/lib/auth/errors";
import type { User, Gender } from "@/types/user";
import PhoneChangeSection from "./PhoneChangeSection";

interface Props {
  user: User;
}

const initialFormFromUser = (user: User) => ({
  firstName: user.firstName ?? "",
  lastName: user.lastName ?? "",
  address: user.address ?? "",
  gender: (user.gender ?? "MALE") as Gender,
});

export default function AccountInformation({ user }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email);
  const [formData, setFormData] = useState(initialFormFromUser(user));
  const [pendingEmailChangeFrom, setPendingEmailChangeFrom] = useState<string | null>(null);
  useEmailChangeWatcher(pendingEmailChangeFrom);

  const updateProfile = useUpdateProfile(user.id);
  const changePassword = useChangePassword();
  const requestEmailChange = useRequestEmailChange();
  const resendVerification = useResendEmailVerification();
  useEmailVerificationWatcher(!user.emailVerified);

  function handleRequestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    requestEmailChange.mutate(newEmail, {
      onSuccess: () => setPendingEmailChangeFrom(user.email),
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(initialFormFromUser(user));
    setNewEmail(user.email);
  }, [user]);

  // Google-only accounts have no password credential to change.
  const hasPasswordProvider = firebaseAuth.currentUser?.providerData.some(
    (p) => p.providerId === "password"
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(formData, { onSuccess: () => setIsEditing(false) });
  }

  return (
    <div className="flex flex-col w-full mt-4 gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Account Information
        </h2>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <FaRegEdit /> Edit
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 sm:p-6">
        {!isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReadField label="First Name" value={user.firstName} />
            <ReadField label="Last Name" value={user.lastName} />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Email
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
                  {user.email}
                  {user.emailVerified ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Unverified</span>
                  )}
                {!user.emailVerified && (
                  <>
                    <button
                      type="button"
                      onClick={() => resendVerification.mutate()}
                      disabled={resendVerification.isPending}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 mr-3"
                    >
                      {resendVerification.isPending ? "Sending\u2026" : "Send verification email"}
                    </button>
                    {resendVerification.isSuccess && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        Verification email sent — check your inbox.
                      </p>
                    )}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowEmailChange((v) => !v)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                Change email
              </button>

              {showEmailChange && (
                <form onSubmit={handleRequestEmailChange} className="flex gap-2 mt-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={requestEmailChange.isPending}
                    className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {requestEmailChange.isPending ? "\u2026" : "Send link"}
                  </button>
                </form>
              )}

              {requestEmailChange.isSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Confirmation link sent to {newEmail}. Your email won&apos;t change until you click it.
                </p>
              )}
              {requestEmailChange.isError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {resolveAuthError(requestEmailChange.error)}
                </p>
              )}

              {pendingEmailChangeFrom && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Waiting for you to click the confirmation link — this updates automatically once you do.
                </p>
              )}
            </div>

            <PhoneChangeSection user={user} />
            <ReadField label="Address" value={user.address ?? "—"} />
            <ReadField label="Gender" value={user.gender ?? "—"} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} />
              <EditField label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} />
              <EditField
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="sm:col-span-2"
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</span>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="mt-0.5 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </label>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">
              Email and phone are changed separately — see the buttons on the view above.
            </p>

            {updateProfile.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {resolveAuthError(updateProfile.error)}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormData(initialFormFromUser(user));
                  setIsEditing(false);
                }}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updateProfile.isPending ? "Saving\u2026" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      {hasPasswordProvider ? (
        <PasswordSection
          expanded={showPasswordSection}
          onToggle={() => setShowPasswordSection((v) => !v)}
          onSubmit={(current, next) =>
            changePassword.mutate({ currentPassword: current, newPassword: next })
          }
          pending={changePassword.isPending}
          error={changePassword.isError ? resolveAuthError(changePassword.error) : null}
          success={changePassword.isSuccess}
        />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You signed in with Google — there&apos;s no password to change here.
        </p>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="text-sm text-slate-900 dark:text-slate-100 mt-0.5">{value || "—"}</p>
    </div>
  );
}

function EditField({
  label,
  name,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
    </label>
  );
}

function PasswordSection({
  expanded,
  onToggle,
  onSubmit,
  pending,
  error,
  success,
}: {
  expanded: boolean;
  onToggle: () => void;
  onSubmit: (current: string, next: string) => void;
  pending: boolean;
  error: string | null;
  success: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirmPassword) {
      setLocalError("New passwords don't match.");
      return;
    }
    onSubmit(currentPassword, newPassword);
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
      <button
        type="button"
        onClick={onToggle}
        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        {expanded ? "Hide Password Settings" : "Change Password"}
      </button>

      {expanded && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 p-4 sm:p-5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordField label="New password" value={newPassword} onChange={setNewPassword} />
            <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
          </div>

          {(localError || error) && (
            <p className="text-sm text-red-600 dark:text-red-400">{localError ?? error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {pending ? "Updating\u2026" : "Change Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="relative">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="w-full pr-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          tabIndex={-1}
          aria-label={revealed ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}