import { useAuthStore } from "@/store/auth-store";
import { useMe } from "@/hooks/useMe";

/**
 * `status` reflects Firebase auth only — "is there a valid signed-in
 * session" — and is what anything gating access should check. `user`
 * (the Postgres-sourced profile) can lag behind or fail independently if
 * the backend is slow or offline; that's a data-availability problem, not
 * an authentication one, so it's exposed separately rather than folded
 * into the same loading/redirect logic.
 */
export default function useAuth() {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const meQuery = useMe();

  return {
    user: profile,
    status,
    isProfileLoading: meQuery.isLoading,
    isProfileError: meQuery.isError,
    profileError: meQuery.error,
  };
}