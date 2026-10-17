import { Suspense } from "react";
import { LandlordNav } from "@/components/landlord/LandlordNav";

export default function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  return (
    <>
      <div className="-mx-6">
        {/* usePathname reads the URL, so the nav needs its own Suspense boundary */}
        <Suspense fallback={<div className="h-11 border-b border-zinc-200 dark:border-zinc-800" />}>
          <LandlordNav />
        </Suspense>
      </div>
      {children}
    </>
  );
}
