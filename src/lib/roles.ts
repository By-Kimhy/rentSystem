import type { Role } from "@prisma/client";

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  LANDLORD: "/landlord",
  TENANT: "/tenant",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  LANDLORD: "Landlord",
  TENANT: "Tenant",
};

// Roles a visitor may pick on the sign-up form. Admins are created by the seed script.
export const SIGNUP_ROLES = ["LANDLORD", "TENANT"] as const;
