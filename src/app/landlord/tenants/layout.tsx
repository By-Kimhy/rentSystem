export default function TenantsLayout({ children }: LayoutProps<"/landlord/tenants">) {
  return <div className="mx-auto w-full max-w-4xl px-6 py-10">{children}</div>;
}
