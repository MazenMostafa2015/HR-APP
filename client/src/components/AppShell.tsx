import { Link, useLocation } from "wouter";
import { Bell, CalendarDays, ChevronRight, ClipboardList, FileBarChart2, LayoutDashboard, LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";

export type AppUser = { id: number; name: string | null; email: string | null; role: string };

type AppShellProps = { user: AppUser; children: React.ReactNode; unreadCount?: number; onLogout: () => void };

const roleLabel: Record<string, string> = { employee: "Employee", manager: "Direct Manager", general_manager: "General Manager", hr: "People Operations", admin: "Administrator" };

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>{!compact && <span><strong>ELMS</strong><small>leave operations</small></span>}</div>;
}

export function AppShell({ user, children, unreadCount = 0, onLogout }: AppShellProps) {
  const [location] = useLocation();
  const nav = [
    { href: "/", label: "Overview", icon: LayoutDashboard, show: true },
    { href: "/requests", label: user.role === "employee" ? "My requests" : "Approval queue", icon: ClipboardList, show: true },
    { href: "/requests/new", label: "New request", icon: CalendarDays, show: user.role === "employee" },
    { href: "/reports", label: "Reports", icon: FileBarChart2, show: ["hr", "admin"].includes(user.role) },
    { href: "/admin", label: "Administration", icon: Settings2, show: ["hr", "admin"].includes(user.role) },
  ].filter(item => item.show);

  return <div className="app-frame">
    <aside className="side-rail">
      <BrandMark />
      <div className="rail-caption">Workspace</div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {nav.map(item => { const Icon = item.icon; const active = location === item.href || (item.href !== "/" && location.startsWith(item.href)); return <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}><Icon size={17} /><span>{item.label}</span>{active && <ChevronRight size={14} className="nav-arrow" />}</Link>; })}
      </nav>
      <div className="rail-spacer" />
      <div className="rail-help"><ShieldCheck size={16} /><div><strong>Three-step control</strong><span>Every decision is recorded.</span></div></div>
      <button className="profile-chip" onClick={onLogout} title="Sign out"><span className="avatar"><UserRound size={16} /></span><span className="profile-copy"><strong>{user.name ?? user.email ?? "Account"}</strong><small>{roleLabel[user.role] ?? user.role}</small></span><LogOut size={15} /></button>
    </aside>
    <main className="main-canvas">
      <header className="topbar"><div className="mobile-brand"><BrandMark compact /></div><div className="breadcrumb"><span>ELMS</span><b>/</b><span>{location === "/" ? "Overview" : location.split("/")[1]?.replace("-", " ")}</span></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} />{unreadCount > 0 && <em>{unreadCount}</em>}</button><span className="topbar-date">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}

export function LoggedOutLanding() {
  return <div className="landing-page"><div className="landing-top"><BrandMark /><span className="secure-note"><ShieldCheck size={15} /> secure workspace</span></div><div className="landing-hero"><div className="landing-copy"><p className="eyebrow">Employee Leave Management System</p><h1>A clear path from <em>time off</em> to final decision.</h1><p className="landing-lead">Submit, review, and close leave requests with a visible three-tier workflow that keeps every handoff accountable.</p><Button size="lg" onClick={() => startLogin()}>Sign in to ELMS <ChevronRight size={17} /></Button><div className="landing-trust"><span><ShieldCheck size={15} /> Role-based access</span><span><ClipboardList size={15} /> Immutable audit trail</span></div></div><div className="landing-panel"><div className="panel-kicker">Approval path</div><div className="landing-step"><span className="step-index done">01</span><div><strong>Direct Manager</strong><small>First-line review</small></div><span className="step-state">required</span></div><div className="landing-connector" /><div className="landing-step"><span className="step-index">02</span><div><strong>General Manager</strong><small>Department oversight</small></div><span className="step-state">required</span></div><div className="landing-connector" /><div className="landing-step"><span className="step-index">03</span><div><strong>HR</strong><small>Final decision & balance</small></div><span className="step-state">required</span></div><div className="landing-panel-footer"><span>Every action logged</span><span>© ELMS</span></div></div></div></div>;
}
