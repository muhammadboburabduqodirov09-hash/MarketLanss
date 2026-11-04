"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, ErrorMessage, PageHeader, SuccessMessage } from "@/components/ui";

export default function SettingsPage() {
  const { imports, t, save, notify } = useApp();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function deleteData() {
    if (!window.confirm(t("deleteAllConfirm"))) return;
    setError("");
    setSuccess("");
    try {
      await save([]);
      setSuccess(t("noImports"));
      notify(t("noImports"));
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <>
      <PageHeader title={t("settingsTitle")} description={t("settingsSub")} />
      <ErrorMessage>{error}</ErrorMessage><SuccessMessage>{success}</SuccessMessage>
      <div className="dashboard-grid">
        <Card className="section-card">
          <div className="section-heading"><h2>{t("profile")}</h2></div>
          <div className="settings-list">
            <div>{t("profile")}</div><div>{t("user")}</div>
            <div>{t("authLabel")}</div><div>{t("authValue")}</div>
            <div>{t("localStorage")}</div><div>{t("storageValue")}</div>
            <div>{t("records")}</div><div>{imports.length} {t("uploads").toLowerCase()}</div>
          </div>
        </Card>
        <Card className="section-card">
          <div className="section-heading"><h2>{t("dataManagement")}</h2></div>
          <div className="section-body">
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.65 }}>Deleting all imports removes their standardized rows and removes them from all analysis screens.</p>
            <Button variant="danger" onClick={deleteData} disabled={!imports.length}>{t("deleteAll")}</Button>
            <div className="message message-error" style={{ marginTop: 16 }}>{t("securityNote")}</div>
          </div>
        </Card>
      </div>
    </>
  );
}
