import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Google Analytics 4 measurement ID (G-XXXXXXXXXX). Inlined at build time; when it is unset no
// analytics script is loaded.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  title: "RentSystem",
  description: "Rent rooms in apartments, condos and houses",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800 print:hidden">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-semibold">
                RentSystem
              </Link>
              <Link href="/rooms" className="text-sm hover:underline">
                Browse rooms
              </Link>
            </div>
            <Suspense fallback={null}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <main className="flex flex-1 flex-col px-6">{children}</main>
      </body>
      {GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}
    </html>
  );
}
