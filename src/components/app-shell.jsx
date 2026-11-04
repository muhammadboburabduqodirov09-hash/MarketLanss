"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, ArrowLeftRight, BarChart3, CircleHelp, FileClock, FileUp, Languages, LayoutDashboard, Menu, Settings, X } from "lucide-react";
import { AppProvider, useApp } from "@/components/app-context";
import { LoadingState } from "@/components/ui";

const navigation = [
  { section: "workspace", items: [{ href: "/", key: "overview", icon: LayoutDashboard }, { href: "/import", key: "importData", icon: FileUp }] },
  { section: "analytics", items: [{ href: "/auditor", key: "auditor", icon: ArrowLeftRight }, { href: "/returns", key: "returns", icon: BarChart3 }] },
  { section: "manage", items: [{ href: "/history", key: "history", icon: FileClock }, { href: "/settings", key: "settings", icon: Settings }, { href: "/help", key: "help", icon: CircleHelp }] },
];

function ShellContent({ children }) {
  const pathname = usePathname();
  const { t, ready, error, toast, language, setLanguage } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!ready) return <div className="full-loading"><LoadingState label={t("loading")} /></div>;
  if (error) return <div className="full-loading"><div className="message message-error">{t("loadError")} {error}<p>Start the app with <code>npm run dev</code> to use local storage.</p></div></div>;

  return (
    <div className="app-layout min-h-screen">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Activity size={18} /></div><div><strong>Marketwise</strong><small>INTELLIGENCE</small></div><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="sidebar-body">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              <p>{t(group.section)}</p>
              {group.items.map(({ href, key, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link ${pathname === href ? "nav-active" : ""}`}>
                  <Icon size={17} strokeWidth={1.8} /><span>{t(key)}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="profile-avatar">L</div>
          <div className="profile-copy"><strong>{t("user")}</strong><small>{t("localMode")}</small></div>
          <span className="online-dot" title={t("localMode")} />
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
          <div className="breadcrumb">Marketplace intelligence <span>/</span> <b>{t(navigation.flatMap((group) => group.items).find((item) => item.href === pathname)?.key || "overview")}</b></div>
          <label className="language-control"><Languages size={16} /><span className="sr-only">{t("language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t("language")}>
              <option value="en">{t("en")}</option><option value="ru">{t("ru")}</option><option value="uz">{t("uz")}</option>
            </select>
          </label>
        </header>
        <main className="main-content mx-auto w-full">{children}</main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default function AppShell({ children }) {
  return <AppProvider><ShellContent>{children}</ShellContent></AppProvider>;
}
