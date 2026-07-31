/**
 * Backend-defined user roles.
 *
 * Roles:
 * - SUPER_ADMIN
 * - ADMIN
 * - DISPATCHER
 * - FIRST_RESPONDER
 * - CITIZEN
 * - HOSPITAL_STAFF
 * - AMBULANCE_CREW
 * - POLICE
 * - FIREFIGHTER
 */

type RoleConfig = {
  name?: string;
  home?: string;
  label?: string;
};

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    home: "/admin",
    label: "Admin Dashboard",
  },
  ADMIN: {
    name: "Admin",
    home: "/admin",
    label: "Admin Dashboard",
  },
  DISPATCHER: {
    name: "Dispatcher",
    home: "/dispatch",
    label: "Dispatch Console",
  },
  HOSPITAL_STAFF: {
    name: "Hospital Staff",
    home: "/hospital",
    label: "Hospital Dashboard",
  },
  CITIZEN: {
    name: "Citizen",
  },
  FIRST_RESPONDER: {
    name: "First Responder",
  },
  AMBULANCE_CREW: {
    name: "Ambulance Crew",
  },
  POLICE: {
    name: "Police",
  },
  FIREFIGHTER: {
    name: "Firefighter",
  },
} as const;

export const getRoleName = (role?: string) =>
  ROLE_CONFIG[role as UserRole]?.name;

export const getRoleHome = (role?: string) =>
  ROLE_CONFIG[role as UserRole]?.home ?? "/";

export const getRoleLabel = (role?: string) =>
  ROLE_CONFIG[role as UserRole]?.label;

export type UserRole = keyof typeof ROLE_CONFIG;

export const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];