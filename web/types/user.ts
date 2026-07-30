import type { UserRole } from "@/lib/auth/roles";

export type Gender = "MALE" | "FEMALE";

export interface User {
  id: number;
  firebaseUid: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  address: string | null;
  roleName: UserRole;
  gender?: Gender;
  profileCompleted: boolean;
  enabled: boolean;
  createdAt: string;
}