import {
  Home,
  ClipboardList,
  Trophy,
  BarChart3,
  Users,
  Settings,
  FileInput,
  ScrollText,
  Sliders,
  Clock,
  Network,
  Award,
  BookOpen,
  RefreshCw,
  CalendarDays,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Simplified top-level navigation (spec §2). Fixtures / Groups / Bracket /
// Awards / Leaders / Scoring are no longer top-level — they live inside the
// Tournament page tabs or the secondary menu.
//
// NOTE: "Predictions" points at /me until the route is renamed to /predictions
// in Phase 3; "Players" keeps the existing /participants route.
export const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/predictions", label: "Predictions", icon: ClipboardList },
  { href: "/tournament", label: "Tournament", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/participants", label: "Players", icon: Users },
];

// Secondary pages — reachable from the profile/overflow menu and the footer,
// never the main nav (spec §2).
export const SECONDARY_NAV: NavItem[] = [
  { href: "/how-it-works", label: "How It Works", icon: BookOpen },
  { href: "/scoring", label: "Scoring Rules", icon: ScrollText },
];

// Five most-used destinations for the sticky mobile bar.
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/predictions", label: "Predict", icon: ClipboardList },
  { href: "/tournament", label: "Tournament", icon: Trophy },
  { href: "/leaderboard", label: "Table", icon: BarChart3 },
  { href: "/participants", label: "Players", icon: Users },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/results", label: "Results", icon: CalendarDays },
  { href: "/admin/sync", label: "API Sync", icon: RefreshCw },
  { href: "/admin/outcomes", label: "Outcomes & Awards", icon: Award },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/fixtures", label: "Fixtures", icon: Network },
  { href: "/admin/scoring", label: "Scoring", icon: Sliders },
  { href: "/admin/deadlines", label: "Deadlines & Locks", icon: Clock },
  { href: "/admin/data", label: "Import / Export", icon: FileInput },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
