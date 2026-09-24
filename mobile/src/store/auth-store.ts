import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";
import type { User } from "@/types/user";

export type AuthStatus =
  | "loading"           // Firebase listener hasn't reported yet
  | "unauthenticated"   // No Firebase user
  | "checking-profile"  // Firebase user exists, backend /me hasn't resolved yet
  | "unregistered"      // Firebase user exists, backend confirmed no account
  | "authenticated";    // Backend confirmed a real account

type AuthState = {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  status: AuthStatus;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User) => void;
  setProfileMissing: () => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  status: "loading",
  setFirebaseUser: (user) =>
    set({
      firebaseUser: user,
      profile: null,
      status: user ? "checking-profile" : "unauthenticated",
    }),
  setProfile: (profile) => set({ profile, status: "authenticated" }),
  setProfileMissing: () => set({ profile: null, status: "unregistered" }),
  reset: () => set({ firebaseUser: null, profile: null, status: "unauthenticated" }),
}));