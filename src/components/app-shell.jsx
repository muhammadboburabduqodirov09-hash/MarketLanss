"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Activity, CircleHelp, FileClock, Languages, LayoutGrid, Moon, Package, Settings, Undo2, Upload, Wallet } from "lucide-react";
import { AppProvider, useApp } from "@/components/app-context";
import { easeOut } from "@/components/motion";
import { LoadingState } from "@/components/ui";

const navigation = [
  { href: "/", key: "dashboardNav", icon: LayoutGrid },
  { href: "/products", key: "catalog.productsNav", icon: Package },
  { href: "/auditor", key: "financials", icon: Wallet },
  { href: "/returns", key: "navReturns", icon: Undo2 },
  { href: "/history", key: "reports", icon: FileClock },
  { href: "/import", key: "uploadNav", icon: Upload },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/help", key: "help", icon: CircleHelp },
];

const isActive = (pathname, href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

// Only mounts after the client has loaded data, so reading the DOM in the initializer is safe.
function ThemeToggle({ label }) {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== "light");

  function toggle() {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch { /* private mode: theme just won't persist */ }
    setDark(!dark);
  }

  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={dark} aria-label={label} onClick={toggle}>
      <Moon size={17} aria-hidden="true" /><span className="theme-label">{label}</span><span className="theme-switch" aria-hidden="true" />
    </button>
  );
}

function ShellContent({ children }) {
  const pathname = usePathname();
  const { t, ready, error, toast, language, setLanguage, imports } = useApp();
  // Screen readers pick the voice from <html lang>; keep it in step with the UI language.
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  if (!ready) return <div className="full-loading"><LoadingState label={t("loading")} /></div>;
  if (error) return <div className="full-loading"><div className="message message-error">{t("loadError")} {error}<p>Start the app with <code>npm run dev</code> to use local storage.</p></div></div>;

  const current = navigation.find(({ href }) => isActive(pathname, href));

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="profile-card">
          <span className="profile-avatar" aria-hidden="true">{t("user").charAt(0)}</span>
          <span className="profile-copy">
            <strong>{t("user")}</strong>
            <small><span>{t("localMode")}</span>{imports.some((item) => item.isDemo) && <span className="profile-pill">{t("demo")}</span>}</small>
          </span>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ href, key, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={`side-link ${active ? "side-active" : ""}`} aria-current={active ? "page" : undefined}>
                {active && <motion.span layoutId="nav-pill" className="nav-pill" style={{ borderRadius: 11 }} transition={{ type: "spring", duration: 0.4, bounce: 0.15 }} />}
                <Icon size={17} aria-hidden="true" /><span className="side-label">{t(key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <label className="language-control"><Languages size={17} aria-hidden="true" /><span className="sr-only">{t("language")}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t("language")}>
              <option value="en">{t("en")}</option><option value="ru">{t("ru")}</option><option value="uz">{t("uz")}</option>
            </select>
          </label>
          <ThemeToggle label={t("darkMode")} />
        </div>
      </aside>
      <div className="main-panel">
        <header className="panel-bar">
          <Link className="brand" href="/" aria-label="Marketwise dashboard">
            <span className="brand-mark"><Activity size={15} aria-hidden="true" /></span>Marketwise
          </Link>
          {current && <span className="panel-bar-title">{t(current.key)}</span>}
        </header>
        <main className="main-content">{children}</main>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div className="toast" aria-hidden="true" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.22, ease: easeOut }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Always mounted so the announcement is a content change screen readers notice. */}
      <div className="sr-only" role="status">{toast}</div>
    </div>
  );
}

export default function AppShell({ children }) {
  // reducedMotion="user": transform animations are skipped for people who ask for less motion; opacity stays.
  return <AppProvider><MotionConfig reducedMotion="user"><ShellContent>{children}</ShellContent></MotionConfig></AppProvider>;
}
