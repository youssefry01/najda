"use client";

import useAuth from "@/hooks/useAuth";
import useTitle from "@/hooks/useTitle";
import Loading from "@/components/General/Loading";
import AuthGuard from "@/components/Auth/AuthGuard";
import RoleProtectedRoute from "@/components/Auth/RoleProtectedRoute";
import AdminFeed from "@/components/Admin/AdminFeed";
import { ADMIN_ROLES } from "@/lib/auth/roles";

function AdminContent() {
  const { user } = useAuth();
  useTitle(user?.firstName ? `@${user.firstName} - NAJDA Admin` : "Admin - NAJDA");

  if (!user) return <Loading />;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <AdminFeed />
    </main>
  );
}

export default function Admin() {
  return (
    <AuthGuard>
      <RoleProtectedRoute allowedRoles={ADMIN_ROLES}>
        <AdminContent />
      </RoleProtectedRoute>
    </AuthGuard>
  );
}