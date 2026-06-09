import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { Badge } from "@/components/ui/badge";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center gap-3">
          <Logo compact />
          <Badge variant="gold">Admin</Badge>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/" className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:flex">
              <ArrowLeft className="h-4 w-4" /> View site
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
        <div className="container pb-3">
          <AdminNav />
        </div>
      </header>
      <main className="container flex-1 py-6">{children}</main>
    </div>
  );
}
