import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </form>
  );
}
