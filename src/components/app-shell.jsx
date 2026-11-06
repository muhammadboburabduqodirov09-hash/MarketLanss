"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronDown, Languages, Settings, CircleHelp } from "lucide-react";
import { AppProvider, useApp } from "@/components/app-context";
import { LoadingState } from "@/components/ui";

const navigation = [
  { href: "/", key: "dashboardNav" },
  { href: "/auditor", key: "financials" },
  { href: "/returns", key: "navReturns" },
  { href: "/history", key: "reports" },
];

function ShellContent({ children }) {
  const pathname = usePathname();
  const { t, ready, error, toast, language, setLanguage } = useApp();

  if (!ready) return <div className="full-loading"><LoadingState label={t("loading")} /></div>;
  if (error) return <div className="full-loading"><div className="message message-error">{t("loadError")} {error}<p>Start the app with <code>npm run dev</code> to use local storage.</p></div></div>;

  return (
    <div className="app-layout min-h-screen">
      <header className="top-navigation">
        <Link className="brand" href="/" aria-label="Marketwise dashboard">
          <span className="brand-mark"><Activity size={17} /></span>
          <span className="brand-copy"><strong>Marketwise</strong><small>INTELLIGENCE</small></span>
        </Link>
        <nav className="primary-navigation" aria-label="Main navigation">
          {navigation.map(({ href, key }) => (
            <Link key={href} href={href} className={`top-nav-link ${pathname === href ? "top-nav-active" : ""}`}>{t(key)}</Link>
          ))}
        </nav>
        <div className="navigation-tools">
          <Link className="top-nav-import" href="/import">{t("uploadNav")}</Link>
          <label className="language-control"><Languages size={15} /><span className="sr-only">{t("language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t("language")}>
              <option value="en">{t("en")}</option><option value="ru">{t("ru")}</option><option value="uz">{t("uz")}</option>
            </select>
          </label>
          <details className="profile-menu">
            <summary aria-label={t("user")}><span className="profile-avatar">L</span><span className="profile-copy"><strong>{t("user")}</strong><small>{t("localMode")}</small></span><ChevronDown size={14} /></summary>
            <div className="profile-dropdown">
              <Link href="/settings"><Settings size={14} />{t("settings")}</Link>
              <Link href="/help"><CircleHelp size={14} />{t("help")}</Link>
            </div>
          </details>
        </div>
      </header>
      <main className="main-content mx-auto w-full">{children}</main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default function AppShell({ children }) {
  return <AppProvider><ShellContent>{children}</ShellContent></AppProvider>;
}
