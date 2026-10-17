export default function ApplicationsLayout({ children }: LayoutProps<"/landlord/applications">) {
  return <div className="mx-auto w-full max-w-4xl px-6 py-10">{children}</div>;
}
