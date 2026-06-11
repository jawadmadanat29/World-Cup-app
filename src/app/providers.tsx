"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { TimeZoneProvider, type TzChoice } from "@/components/providers/timezone-provider";

export function Providers({
  children,
  initialTz,
  initialChoice,
}: {
  children: React.ReactNode;
  initialTz: string;
  initialChoice: TzChoice;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <TimeZoneProvider initialTz={initialTz} initialChoice={initialChoice}>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster richColors closeButton position="top-center" />
      </TimeZoneProvider>
    </ThemeProvider>
  );
}
