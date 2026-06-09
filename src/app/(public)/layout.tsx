import { SiteHeader } from "@/components/layout/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getCurrentParticipant, isAdmin } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [participant, admin] = await Promise.all([getCurrentParticipant(), isAdmin()]);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        isAdmin={admin}
        participant={
          participant
            ? { id: participant.id, name: participant.name, initials: participant.initials, accentColor: participant.accentColor, avatarId: participant.avatarId }
            : null
        }
      />
      <main className="container flex-1 py-6 pb-24 lg:pb-10">{children}</main>
      <MobileNav />
    </div>
  );
}
