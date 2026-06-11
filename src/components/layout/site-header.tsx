"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LogOut, Menu, User, BookOpen, ScrollText } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TimeZoneSwitcher } from "@/components/layout/timezone-switcher";
import { ParticipantAvatar } from "@/components/domain/participant-avatar";
import { PUBLIC_NAV, SECONDARY_NAV } from "@/lib/nav";
import { logoutUser } from "@/actions/participant-auth";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface HeaderParticipant {
  id: string;
  name: string;
  initials: string;
  accentColor: string;
  avatarId?: string | null;
}

const SECONDARY_ICONS: Record<string, typeof BookOpen> = {
  "/how-it-works": BookOpen,
  "/scoring": ScrollText,
};

export function SiteHeader({
  participant,
  isAdmin = false,
}: {
  participant: HeaderParticipant | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-16 max-w-full items-center gap-3">
        <Logo className="shrink-0" />
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <TimeZoneSwitcher />
          <ThemeToggle />

          {participant ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-sm font-medium transition-colors hover:bg-secondary/60",
                    (isActive("/predictions") || isActive("/participants")) && "bg-secondary",
                  )}
                  aria-label="Account menu"
                >
                  <ParticipantAvatar initials={participant.initials} color={participant.accentColor} avatarId={participant.avatarId} size="sm" />
                  <span className="hidden max-w-[8rem] truncate sm:inline">{participant.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{participant.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/participants/${participant.id}`}>
                    <User /> My profile
                  </Link>
                </DropdownMenuItem>
                {SECONDARY_NAV.map((item) => {
                  const Icon = SECONDARY_ICONS[item.href] ?? BookOpen;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <Icon /> {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield /> Admin controls
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <form action={logoutUser}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut /> Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
                Sign in
              </Link>
              <Link href="/signup" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
                Join
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild className="sm:hidden">
                    <Link href="/login">
                      <User /> Sign in
                    </Link>
                  </DropdownMenuItem>
                  {SECONDARY_NAV.map((item) => {
                    const Icon = SECONDARY_ICONS[item.href] ?? BookOpen;
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>
                          <Icon /> {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <Shield /> Admin controls
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
