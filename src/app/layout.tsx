import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { Providers } from "./providers";
import { DEFAULT_TZ } from "@/components/providers/timezone-provider";

export const metadata: Metadata = {
  title: {
    default: "World Cup Predictor 2026",
    template: "%s · World Cup Predictor 2026",
  },
  description: "A private prediction game for the FIFA World Cup 2026 — Friends League.",
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialChoice = cookieStore.get("tzChoice")?.value || "local";
  const initialTz = cookieStore.get("tz")?.value || DEFAULT_TZ;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers initialTz={initialTz} initialChoice={initialChoice}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
