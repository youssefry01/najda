import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/api/client";
import { useAuthStore } from "@/store/auth-store";
import type { User } from "@/types/user";

export function useMe() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setProfileMissing = useAuthStore((s) => s.setProfileMissing);

  const query = useQuery({
    queryKey: ["me", firebaseUser?.uid],
    queryFn: () => apiFetch<User>("/api/auth/me"),
    enabled: !!firebaseUser,
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 403 ? false : failureCount < 2,
  });

  useEffect(() => {
    if (query.data) setProfile(query.data);
  }, [query.data, setProfile]);

  useEffect(() => {
    if (query.isError && query.error instanceof ApiError && query.error.status === 403) {
      setProfileMissing();
    }
  }, [query.isError, query.error, setProfileMissing]);

  return query;
}