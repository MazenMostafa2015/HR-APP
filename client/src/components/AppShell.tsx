import { Link, useLocation } from "wouter";
import { Bell, CalendarDays, ChevronRight, ClipboardList, FileBarChart2, LayoutDashboard, LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";

export type AppUser = { id: number; employeeId?: string | null; name: string | null; email: string | null; role: string };
type AppShellProps = { user: AppUser; children: React.ReactNode; unreadCount?: number; onLogout: () => void };

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  return <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>{!compact && <span><strong>ELMS</strong><small>{t("leaveOperations")}</small></span>}</div>;
}

export function AppShell({ user, children, unreadCount = 0, onLogout }: AppShellProps) {
  const { language, setLanguage, t } = useLanguage();
  const [location] = useLocation();
  const roleLabel: Record<string, string> = { employee: t("employee"), manager: t("directManager"), general_manager: t("generalManager"), hr: t("peopleOperations"), admin: t("administrator") };
  const nav = [
    { href: "/", label: t("overview"), icon: LayoutDashboard, show: true },
    { href: "/requests", label: user.role === "employee" ? t("myRequests") : t("approvalQueue"), icon: ClipboardList, show: true },
    { href: "/requests/new", label: t("newRequest"), icon: CalendarDays, show: user.role === "employee" },
    { href: "/reports", label: t("reports"), icon: FileBarChart2, show: ["hr", "admin"].includes(user.role) },
    { href: "/admin", label: t("administration"), icon: Settings2, show: ["hr", "admin"].includes(user.role) },
  ].filter(item => item.show);
  const toggleLanguage = () => setLanguage(language === "en" ? "ar" : "en");

  return <div className="app-frame">
    <aside className="side-rail">
      <BrandMark />
      <div className="rail-caption">{t("workspace")}</div>
      <nav className="primary-nav" aria-label={t("workspace")}>
        {nav.map(item => { const Icon = item.icon; const active = location === item.href || (item.href !== "/" && location.startsWith(item.href)); return <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`}><Icon size={17} /><span>{item.label}</span>{active && <ChevronRight size={14} className="nav-arrow" />}</Link>; })}
      </nav>
      <div className="rail-spacer" />
      <div className="rail-help"><ShieldCheck size={16} /><div><strong>{t("threeStepControl")}</strong><span>{t("everyDecisionRecorded")}</span></div></div>
      <button className="profile-chip" onClick={onLogout} title={t("signOut")}><span className="avatar"><UserRound size={16} /></span><span className="profile-copy"><strong>{user.name ?? user.email ?? "Account"}</strong><small>{roleLabel[user.role] ?? user.role}</small></span><LogOut size={15} /></button>
    </aside>
    <main className="main-canvas">
      <header className="topbar"><div className="mobile-brand"><BrandMark compact /></div><div className="breadcrumb"><span>ELMS</span><b>/</b><span>{location === "/" ? t("overview") : location.split("/")[1]?.replace("-", " ")}</span></div><div className="topbar-actions"><button className="icon-button" aria-label={t("notifications")}><Bell size={18} />{unreadCount > 0 && <em>{unreadCount}</em>}</button><button className="language-toggle" onClick={toggleLanguage} aria-label={t("language")}>{language === "en" ? "العربية" : "English"}</button><span className="topbar-date">{new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}

export function LoggedOutLanding() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="landing-page"><div className="landing-top"><BrandMark /><div className="flex items-center gap-3"><button className="language-toggle" onClick={() => setLanguage(language === "en" ? "ar" : "en")}>{language === "en" ? "العربية" : "English"}</button><span className="secure-note"><ShieldCheck size={15} /> {t("secureWorkspace")}</span></div></div><div className="landing-hero"><div className="landing-copy"><p className="eyebrow">Employee Leave Management System</p><h1>A clear path from <em>time off</em> to final decision.</h1><p className="landing-lead">Submit, review, and close leave requests with a visible three-tier workflow that keeps every handoff accountable.</p><Button size="lg" onClick={() => startLogin()}>{t("signIn")} <ChevronRight size={17} /></Button><div className="landing-trust"><span><ShieldCheck size={15} /> Role-based access</span><span><ClipboardList size={15} /> Immutable audit trail</span></div></div><div className="landing-panel"><div className="panel-kicker">Approval path</div><div className="landing-step"><span className="step-index done">01</span><div><strong>{t("directManager")}</strong><small>First-line review</small></div><span className="step-state">required</span></div><div className="landing-connector" /><div className="landing-step"><span className="step-index">02</span><div><strong>{t("generalManager")}</strong><small>Department oversight</small></div><span className="step-state">required</span></div><div className="landing-connector" /><div className="landing-step"><span className="step-index">03</span><div><strong>HR</strong><small>Final decision & balance</small></div><span className="step-state">required</span></div><div className="landing-panel-footer"><span>Every action logged</span><span>© ELMS</span></div></div></div></div>;
}
