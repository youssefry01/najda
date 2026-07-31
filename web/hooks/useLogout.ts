import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAuthStore } from "@/store/auth-store";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reset = useAuthStore((s) => s.reset);

  return async function logout() {
    // Server-side cookie first — that's the real security boundary, not
    // the client Firebase state. If this fails, a stale tab could still
    // reach a protected page even though the UI looks signed out.
    const sessionCleared = await fetch("/api/session", { method: "DELETE" })
      .then((res) => res.ok)
      .catch(() => false);

    if (!sessionCleared) {
      console.error("Failed to clear session cookie during logout.");
    }

    await signOut(firebaseAuth).catch(() => null);

    reset();
    queryClient.removeQueries({ queryKey: ["me"] });

    router.push("/login");
    router.refresh(); // drop cached RSC output for anything gated by the now-cleared cookie
  };
}