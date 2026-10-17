// The shapes the API returns. Routes build their queries from the include objects here, and the
// Next.js app imports the response types (type-only), so both sides agree on every field.
//
// Over JSON, Prisma decimals arrive as strings ("1200.00") and dates as ISO strings; the Next.js
// client turns the dates back into Date objects, which is what Wire<T> describes.
import type { Prisma } from "@prisma/client";

export type Wire<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;

const firstPhoto = { take: 1, orderBy: { createdAt: "asc" } } satisfies Prisma.Property$photosArgs;
const allPhotos = { orderBy: { createdAt: "asc" } } satisfies Prisma.Property$photosArgs;
const roomLabel = { select: { name: true, property: { select: { name: true } } } } satisfies Prisma.RoomDefaultArgs;
const primaryTenantName = {
  where: { isPrimary: true },
  select: { tenant: { select: { fullName: true } } },
} satisfies Prisma.Lease$tenantsArgs;
const payerName = { select: { fullName: true } } satisfies Prisma.TenantDefaultArgs;

export const UNPAID = ["OPEN", "PARTIAL", "OVERDUE"] as const;

// ---- Accounts

export type CurrentUser = { id: string; name: string; email: string; role: "ADMIN" | "LANDLORD" | "TENANT" };
export type AuthResponse = { user: CurrentUser; token: string };

export const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
export type UserListItem = Wire<Prisma.UserGetPayload<{ select: typeof userListSelect }>>;

// ---- Properties and rooms

export const propertyCardInclude = {
  photos: firstPhoto,
  rooms: { select: { status: true, rentPrice: true } },
} satisfies Prisma.PropertyInclude;
export type PropertyCard = Wire<Prisma.PropertyGetPayload<{ include: typeof propertyCardInclude }>>;

export const propertyDetailInclude = {
  photos: allPhotos,
  rooms: {
    orderBy: { name: "asc" },
    include: { photos: firstPhoto, _count: { select: { leases: true } } },
  },
} satisfies Prisma.PropertyInclude;
export type PropertyDetail = Wire<Prisma.PropertyGetPayload<{ include: typeof propertyDetailInclude }>>;

export const roomDetailInclude = {
  property: { select: { id: true, name: true } },
  photos: allPhotos,
} satisfies Prisma.RoomInclude;
export type RoomDetail = Wire<Prisma.RoomGetPayload<{ include: typeof roomDetailInclude }>>;

export type Property = Wire<Prisma.PropertyGetPayload<object>>;
export type Room = Wire<Prisma.RoomGetPayload<object>>;
export type Photo = Wire<Prisma.PhotoGetPayload<object>>;

// Public listings never include the landlord's account.
export const listingInclude = {
  photos: allPhotos,
  property: { include: { photos: allPhotos } },
} satisfies Prisma.RoomInclude;
export type Listing = Wire<Prisma.RoomGetPayload<{ include: typeof listingInclude }>>;

// ---- Tenants

export const tenantListInclude = {
  leases: {
    include: {
      lease: {
        select: {
          status: true,
          room: roomLabel,
          invoices: { where: { status: { in: [...UNPAID] } }, select: { total: true, amountPaid: true } },
        },
      },
    },
  },
} satisfies Prisma.TenantInclude;
export type TenantListItem = Wire<Prisma.TenantGetPayload<{ include: typeof tenantListInclude }>>;

export const tenantDetailInclude = {
  leases: {
    orderBy: { lease: { startDate: "desc" } },
    include: { lease: { include: { room: { include: { property: { select: { name: true } } } } } } },
  },
} satisfies Prisma.TenantInclude;
export type TenantDetail = Wire<Prisma.TenantGetPayload<{ include: typeof tenantDetailInclude }>>;
export type Tenant = Wire<Prisma.TenantGetPayload<object>>;

export const paymentRowInclude = {
  payer: payerName,
  lease: { select: { room: roomLabel } },
} satisfies Prisma.PaymentInclude;
export type PaymentRow = Wire<Prisma.PaymentGetPayload<{ include: typeof paymentRowInclude }>>;

export type Invoice = Wire<Prisma.InvoiceGetPayload<object>>;

export type TenantResponse = {
  tenant: TenantDetail;
  invoices: Invoice[];
  payments: PaymentRow[];
  creditCents: number;
};

// ---- Leases

export const leaseListInclude = {
  room: roomLabel,
  tenants: { include: { tenant: { select: { fullName: true } } }, orderBy: { isPrimary: "desc" } },
} satisfies Prisma.LeaseInclude;
export type LeaseListItem = Wire<Prisma.LeaseGetPayload<{ include: typeof leaseListInclude }>>;

export const leaseDetailInclude = {
  room: { include: { property: true } },
  tenants: { include: { tenant: true }, orderBy: { isPrimary: "desc" } },
  invoices: { orderBy: [{ dueDate: "desc" }, { number: "desc" }] },
  payments: { orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }], include: { payer: payerName } },
  renewedFrom: { select: { id: true } },
  renewedBy: { select: { id: true, status: true } },
} satisfies Prisma.LeaseInclude;
export type LeaseDetail = Wire<Prisma.LeaseGetPayload<{ include: typeof leaseDetailInclude }>>;
export type Lease = Wire<Prisma.LeaseGetPayload<object>>;

export type DepositSummary = {
  receivedCents: number;
  deductedCents: number;
  refundedCents: number;
  heldCents: number;
  transactions: Wire<Prisma.DepositTransactionGetPayload<object>>[];
};

export type LeaseResponse = { lease: LeaseDetail; creditCents: number; deposit: DepositSummary };

// Saving with intent "activate" can save the draft but fail to activate it (the room is taken).
export type LeaseSaveResponse = { lease: Lease; activationError?: string };

export const leaseFormPropertyInclude = { rooms: { orderBy: { name: "asc" } } } satisfies Prisma.PropertyInclude;
export type LeaseFormOptions = {
  properties: Wire<Prisma.PropertyGetPayload<{ include: typeof leaseFormPropertyInclude }>>[];
  tenants: { id: string; fullName: string }[];
};

// ---- Invoices

export const invoiceListInclude = {
  lease: { select: { room: roomLabel, tenants: primaryTenantName } },
} satisfies Prisma.InvoiceInclude;
export type InvoiceListItem = Wire<Prisma.InvoiceGetPayload<{ include: typeof invoiceListInclude }>>;

export const invoiceDetailInclude = {
  lines: { orderBy: { createdAt: "asc" } },
  allocations: { orderBy: { createdAt: "asc" }, include: { payment: true } },
  lease: {
    include: {
      room: { include: { property: { include: { landlord: { select: { name: true, email: true } } } } } },
      tenants: { where: { isPrimary: true }, include: { tenant: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;
export type InvoiceDetail = Wire<Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>>;

// ---- Payments

export const paymentLeaseOptionInclude = {
  room: roomLabel,
  tenants: { orderBy: { isPrimary: "desc" }, include: { tenant: { select: { id: true, fullName: true } } } },
} satisfies Prisma.LeaseInclude;
export type PaymentOptions = {
  leases: Wire<Prisma.LeaseGetPayload<{ include: typeof paymentLeaseOptionInclude }>>[];
  // Unpaid invoices of the chosen lease, oldest due first.
  invoices: Invoice[];
};

export const paymentDetailInclude = {
  payer: true,
  receivedBy: { select: { name: true } },
  allocations: { include: { invoice: true }, orderBy: { createdAt: "asc" } },
  reversedBy: { select: { id: true } },
  reversalOf: { select: { id: true } },
  lease: { include: { room: { include: { property: true } } } },
} satisfies Prisma.PaymentInclude;
export type PaymentDetail = Wire<Prisma.PaymentGetPayload<{ include: typeof paymentDetailInclude }>>;
export type Payment = Wire<Prisma.PaymentGetPayload<object>>;

// ---- Dashboard

export const dashboardUnpaidInclude = {
  lease: {
    select: {
      id: true,
      room: roomLabel,
      tenants: { where: { isPrimary: true }, select: { tenant: { select: { id: true, fullName: true, phone: true } } } },
    },
  },
} satisfies Prisma.InvoiceInclude;

export const dashboardEndingInclude = {
  room: roomLabel,
  tenants: primaryTenantName,
} satisfies Prisma.LeaseInclude;

export type Dashboard = {
  rooms: number;
  occupied: number;
  billedCents: number;
  collectedCents: number;
  unpaid: Wire<Prisma.InvoiceGetPayload<{ include: typeof dashboardUnpaidInclude }>>[];
  ending: Wire<Prisma.LeaseGetPayload<{ include: typeof dashboardEndingInclude }>>[];
};

// ---- Errors

/** Every non-2xx response has this body. */
export type ApiErrorBody = { error: string; fieldErrors?: Record<string, string[] | undefined> };

// ---- Rental applications

// What the applicant sees: never the landlord's account, only the room they applied for.
export const myApplicationInclude = {
  room: {
    select: { id: true, name: true, rentPrice: true, status: true, property: { select: { name: true, city: true } } },
  },
} satisfies Prisma.ApplicationInclude;
export type MyApplication = Wire<Prisma.ApplicationGetPayload<{ include: typeof myApplicationInclude }>>;

export const applicationInclude = {
  applicant: { select: { name: true, email: true } },
  room: {
    select: {
      id: true,
      name: true,
      rentPrice: true,
      maxOccupants: true,
      status: true,
      property: { select: { id: true, name: true } },
    },
  },
  tenant: { select: { id: true, fullName: true } },
} satisfies Prisma.ApplicationInclude;
export type Application = Wire<Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>>;

// ---- Tenant's own view
//
// A tenant account sees the leases its tenant records are on (linked when an application is
// approved), but never the landlord's notes, other tenants' contact or ID details, or who
// recorded a payment.

export const tenantLeaseSelect = {
  id: true,
  roomId: true,
  status: true,
  startDate: true,
  endDate: true,
  terminatedOn: true,
  rentAmount: true,
  dueDay: true,
  depositAmount: true,
  graceDays: true,
  lateFeeType: true,
  lateFeeValue: true,
  room: {
    select: {
      name: true,
      property: { select: { name: true, address: true, city: true, landlord: { select: { name: true, email: true } } } },
    },
  },
  tenants: { orderBy: { isPrimary: "desc" }, select: { isPrimary: true, tenant: { select: { fullName: true } } } },
} satisfies Prisma.LeaseSelect;
export type TenantLease = Wire<Prisma.LeaseGetPayload<{ select: typeof tenantLeaseSelect }>>;

export const tenantPaymentSelect = {
  id: true,
  leaseId: true,
  amount: true,
  method: true,
  paidOn: true,
  reference: true,
  reversalOfId: true,
  payer: payerName,
} satisfies Prisma.PaymentSelect;
export type TenantPayment = Wire<Prisma.PaymentGetPayload<{ select: typeof tenantPaymentSelect }>>;

export type TenantHome = {
  leases: (TenantLease & { creditCents: number; depositHeldCents: number })[];
  // Every invoice on those leases except void ones, newest due first.
  invoices: Invoice[];
  payments: TenantPayment[];
};

export const tenantInvoiceInclude = {
  lines: { orderBy: { createdAt: "asc" } },
  allocations: {
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, paymentId: true, payment: { select: { paidOn: true, reversalOfId: true } } },
  },
  lease: {
    select: {
      id: true,
      room: {
        select: {
          name: true,
          property: { select: { name: true, address: true, city: true, landlord: { select: { name: true, email: true } } } },
        },
      },
      tenants: { where: { isPrimary: true }, select: { tenant: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.InvoiceInclude;
export type TenantInvoice = Wire<Prisma.InvoiceGetPayload<{ include: typeof tenantInvoiceInclude }>>;

// Enum string unions, for the web app.
export type {
  ApplicationStatus,
  DepositTransactionKind,
  InvoiceKind,
  InvoiceStatus,
  LateFeeType,
  LeaseStatus,
  PaymentMethod,
  PropertyType,
  Role,
  RoomStatus,
} from "@prisma/client";
