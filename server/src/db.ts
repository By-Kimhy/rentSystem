import { PrismaClient } from "@prisma/client";

// The invite hash never leaves the API; queries that need it filter on it instead.
export const prisma = new PrismaClient({ omit: { tenant: { inviteTokenHash: true } } });
