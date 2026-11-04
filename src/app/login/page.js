"use client";

import Link from "next/link";
import { useApp } from "@/components/app-context";
import { Card, PageHeader } from "@/components/ui";

export default function LoginPage() {
  const { t } = useApp();
  return <><PageHeader title={t("signInTitle")} description={t("signInDescription")} /><Card><div className="section-body"><div className="info-box">{t("authValue")}. {t("authNotConfigured")}</div><Link href="/" className="button button-primary" style={{ marginTop: 14 }}>{t("continueLocal")}</Link></div></Card></>;
}
