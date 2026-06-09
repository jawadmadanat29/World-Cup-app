import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold tracking-tight text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">That page doesn’t exist. Head back to the dashboard.</p>
      <Button asChild><Link href="/">Back to dashboard</Link></Button>
    </div>
  );
}
