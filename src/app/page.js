"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowLeftRight, Box, FileClock, FileUp, PackageSearch, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, StatCard, formatDate } from "@/components/ui";
import { calculatePaymentAudit } from "@/lib/data";
import { createDemoImports } from "@/lib/demo";
import { translateReport } from "@/lib/translations";

export default function DashboardPage() {
  const { imports, t, language, save, notify } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const audit = calculatePaymentAudit(imports);
  const orders = audit.orderCount;
  const returned = imports.filter((item) => item.reportType === "returns").flatMap((item) => item.rows)
    .reduce((total, row) => total + (row.quantity ?? 1), 0);
  const returnRecords = imports.filter((item) => item.reportType === "returns").reduce((total, item) => total + item.rows.length, 0);
  const paymentSummary = audit.hasUsableOrders && audit.hasUsablePayments
    ? `${audit.discrepancyCount} ${t("discrepancies").toLowerCase()} · ${audit.orderCount} ${t("orders").toLowerCase()}`
    : t("importRequired");
  const returnSummary = returnRecords
    ? `${returned} ${t("returnsTotal").toLowerCase()} · ${returnRecords} ${t("records").toLowerCase()}`
    : t("noReturns");

  async function loadDemo() {
    if (busy) return;
    if (imports.some((item) => item.isDemo) && !window.confirm(`${t("demoLoaded")} ${t("replaceDemoConfirm")}`)) return;
    setBusy(true);
    setError("");
    try {
      await save([...imports.filter((item) => !item.isDemo), ...createDemoImports()]);
      notify(t("demoLoaded"));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("dashboard")} description={t("dashboardSub")} actions={
        <Button onClick={loadDemo} disabled={busy}><ArrowDownToLine size={15} />{busy ? t("loading") : t("loadDemo")}</Button>
      } />
      <ErrorMessage>{error}</ErrorMessage>
      {!imports.length ? (
        <Card><EmptyState title={t("emptyTitle")} description={t("emptyText")} action={
          <div className="page-actions"><Link href="/import" className="button button-primary"><FileUp size={15} />{t("importFirst")}</Link><Button variant="secondary" onClick={loadDemo}><ArrowDownToLine size={15} />{t("loadDemo")}</Button></div>
        } /></Card>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label={t("uploads")} value={imports.length} icon={FileClock} note={`${imports.filter((item) => item.isDemo).length} ${t("demo")} files`} />
            <StatCard label={t("orders")} value={orders.toLocaleString()} icon={ShoppingBag} note={`${imports.filter((item) => item.reportType === "orders").length} ${t("ordersReport").toLowerCase()}`} />
            <StatCard label={t("discrepancies")} value={audit.discrepancyCount.toLocaleString()} icon={AlertTriangle} note={audit.hasUsableOrders && audit.hasUsablePayments ? t("auditTitle") : t("importRequired")} />
            <StatCard label={t("returnsTotal")} value={returned.toLocaleString()} icon={Box} note={`${imports.filter((item) => item.reportType === "returns").length} ${t("returnsReport").toLowerCase()}`} />
          </div>
          <div className="dashboard-grid">
            <Card className="section-card">
              <div className="section-heading"><h2>{t("recentImports")}</h2><Link href="/history">{t("history")} →</Link></div>
              <div className="data-table-wrap"><table className="data-table">
                <thead><tr><th>{t("file")}</th><th>{t("reportType")}</th><th>{t("records")}</th><th>{t("date")}</th><th>{t("status")}</th></tr></thead>
                <tbody>{[...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 5).map((item) => (
                  <tr key={item.id}><td className="table-primary">{item.fileName}</td><td>{translateReport(t, item.reportType)}</td><td>{item.rows.length.toLocaleString()}</td><td>{formatDate(item.importedAt, language)}</td><td><Badge tone={item.isDemo ? "blue" : "success"}>{item.isDemo ? t("demo") : t("imported")}</Badge></td></tr>
                ))}</tbody>
              </table></div>
            </Card>
            <Card className="section-card">
              <div className="section-heading"><h2>{t("recentAnalyses")}</h2></div>
              <div className="section-body">
                <Link className="quick-link" href="/auditor"><span className="quick-icon"><ArrowLeftRight size={17} /></span><span><strong>{t("openAuditor")}</strong><small>{paymentSummary}</small></span><Activity className="muted" size={15} /></Link>
                <Link className="quick-link" href="/returns"><span className="quick-icon"><PackageSearch size={17} /></span><span><strong>{t("openReturns")}</strong><small>{returnSummary}</small></span><Activity className="muted" size={15} /></Link>
                <Link className="quick-link" href="/import"><span className="quick-icon"><FileUp size={17} /></span><span><strong>{t("importData")}</strong><small>{t("quickImportDescription")}</small></span><Activity className="muted" size={15} /></Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
