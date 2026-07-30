"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreateEmployee } from "@/hooks/useCreateEmployee";
import useAuth from "@/hooks/useAuth";
import { getRoleName, ROLE_CONFIG } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/roles";
import GeneratedLinkBox from "./GeneratedLinkBox";
import type { Gender } from "@/types/user";

const CITIZEN_ROLE: UserRole = "CITIZEN";

export default function CreateEmployeeModal({ onClose }: { onClose: () => void }) {
  const { user: viewer } = useAuth();
  const createEmployee = useCreateEmployee();
  const roles = Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>;

  // Citizens self-register -- not an admin-creation target. SUPER_ADMIN is
  // only offered to a viewer who's already a SUPER_ADMIN, mirroring the
  // backend's own check.
  const assignableRoles = roles.filter((role) => {
    if (role === CITIZEN_ROLE) return false;
    if (role === "SUPER_ADMIN" && viewer?.roleName !== "SUPER_ADMIN") return false;
    return true;
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    gender: "MALE" as Gender,
    roleName: assignableRoles[0],
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createEmployee.mutate(form);
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create Employee Account</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {createEmployee.isSuccess ? (
        <div className="p-5 flex flex-col gap-3">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Account created for {createEmployee.data.user.firstName} {createEmployee.data.user.lastName}.
            </p>
            <GeneratedLinkBox link={createEmployee.data.resetLink} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
            Same as the reset-link flow elsewhere: this doesn&apos;t get emailed automatically — share it with
            them so they can set their own password.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} required />
              <Input label="Last name" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} required />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
            <Input label="Phone" type="tel" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} required />
            <Input label="Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} required />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</span>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
              <select
                value={form.roleName}
                onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value as UserRole }))}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {getRoleName(role)}
                  </option>
                ))}
              </select>
            </label>

            {createEmployee.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {createEmployee.error instanceof Error ? createEmployee.error.message : "Couldn't create account."}
              </p>
            )}

            <button
              type="submit"
              disabled={createEmployee.isPending}
              className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createEmployee.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {createEmployee.isPending ? "Creating\u2026" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}