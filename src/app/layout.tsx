import type { Metadata, Viewport } from "next";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { Providers } from "./providers";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
