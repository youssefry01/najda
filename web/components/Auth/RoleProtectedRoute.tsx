"use client";

import { FC, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth/roles";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

const RoleProtectedRoute: FC<RoleProtectedRouteProps> = ({ children, allowedRoles }) => {
  const router = useRouter();
  const { user, status, isProfileLoading, isProfileError } = useAuth();

  const stillResolving = status === "loading" || (status === "authenticated" && isProfileLoading);
  const isAllowed = !!user && allowedRoles.includes(user.roleName);

  useEffect(() => {
    if (stillResolving) return;
    if (isProfileError) return; // network/backend issue — don't punish the user for it
    if (!isAllowed) router.push("/");
  }, [stillResolving, isProfileError, isAllowed, router]);

  if (stillResolving) return null;
  if (isProfileError) return <ProfileUnavailable />;
  if (!isAllowed) return null;

  return <>{children}</>;
};

function ProfileUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-center px-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Couldn&apos;t verify your account right now.</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        The backend might be offline — this will resolve once it&apos;s back up.
      </p>
    </div>
  );
}

export default RoleProtectedRoute;