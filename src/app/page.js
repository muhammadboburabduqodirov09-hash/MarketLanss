"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Box,
  FileClock,
  FileUp,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, formatDate, formatMoney } from "@/components/ui";
import { calculateInventoryInsights, calculatePaymentAudit, calculateReturns } from "@/lib/data";
import { createDemoImports } from "@/lib/demo";
import { translateReport } from "@/lib/translations";

const chartColors = ["#16865b", "#d34c4c", "#e7a53d", "#5273bd", "#8b70b4", "#52a5a0"];

function getMonthlyData(imports) {
  const months = new Map();
  const getMonth = (date) => {
    const key = /^\d{4}-\d{2}/.test(date || "") ? date.slice(0, 7) : "Undated";
    if (!months.has(key)) months.set(key, { month: key, revenue: 0, refunds: 0, returns: 0 });
    return months.get(key);
  };

  imports.filter((item) => item.reportType === "orders").flatMap((item) => item.rows).forEach((row) => {
    const revenue = row.amount ?? (Number.isFinite(row.unitPrice) && Number.isFinite(row.quantity) ? row.unitPrice * row.quantity : null);
    if (Number.isFinite(revenue)) getMonth(row.date).revenue += revenue;
  });
  imports.filter((item) => item.reportType === "payments").flatMap((item) => item.rows).forEach((row) => {
    if (row.transactionType !== "refund" && !Number.isFinite(row.refund)) return;
    const refund = row.refund ?? row.amount;
    if (Number.isFinite(refund)) getMonth(row.date).refunds += Math.abs(refund);
  });
  calculateReturns(imports).records.forEach((row) => { getMonth(row.date).returns += 1; });

  return [...months.values()].sort((first, second) => first.month.localeCompare(second.month));
}

export default function DashboardPage() {
  const { imports, t, language, save, notify } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chartType, setChartType] = useState("line");
  const [aiStatus, setAiStatus] = useState("checking");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [marketSeasonContext, setMarketSeasonContext] = useState("");
  const audit = calculatePaymentAudit(imports);
  const returns = calculateReturns(imports);
  const inventory = useMemo(() => calculateInventoryInsights(imports), [imports]);
  const inventorySignature = useMemo(() => JSON.stringify(inventory), [inventory]);
  const monthlyData = useMemo(() => getMonthlyData(imports), [imports]);
  const recentReturns = [...returns.records].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
  const recentImports = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 4);
  const refundTotal = monthlyData.reduce((total, item) => total + item.refunds, 0);
  const revenueTotal = monthlyData.reduce((total, item) => total + item.revenue, 0);
  const latestTransactions = imports.filter((item) => item.reportType === "payments")
    .flatMap((item) => item.rows.map((row) => ({ ...row, _fileName: item.fileName })))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);
  const hasData = imports.some((item) => item.rows.length);

  useEffect(() => {
    let active = true;
    fetch("/api/analytics")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check AI configuration.");
        return response.json();
      })
      .then((data) => { if (active) setAiStatus(data.configured ? "ready" : "missing"); })
      .catch(() => { if (active) setAiStatus("unavailable"); });
    return () => { active = false; };
  }, []);

  async function analyzeInventory() {
    if (aiBusy || aiStatus !== "ready" || !inventory.length) return;
    setAiBusy(true);
    setAiError("");
    setAiAnalysis(null);
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          marketSeasonContext,
          products: inventory.slice(0, 200).map((item) => ({
            name: item.name,
            sku: item.sku,
            stock: item.stock,
            averageMonthlyDemand: item.averageMonthlyDemand,
            latestMonth: item.latestMonth,
            latestUnits: item.latestUnits,
            change: item.change,
            monthlySalesHistory: item.monthlySalesHistory,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("aiRequestFailed"));
      setAiAnalysis({ ...result, sourceSignature: inventorySignature });
    } catch (requestError) {
      setAiError(requestError.message || t("aiRequestFailed"));
    } finally {
      setAiBusy(false);
    }
  }

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

  function chartContent() {
    if (!monthlyData.length) return <EmptyState title={t("chartNoData")} description={t("chartImportHint")} action={<Link className="text-link" href="/import">{t("importFirst")} →</Link>} />;
    const currencyTooltip = (value) => formatMoney(value, language);
    if (chartType === "pie") {
      const revenueMonths = monthlyData.filter((item) => item.revenue > 0);
      if (!revenueMonths.length) return <EmptyState title={t("chartNoData")} description={t("revenueUnavailable")} />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={revenueMonths} dataKey="revenue" nameKey="month" innerRadius={62} outerRadius={104} paddingAngle={2}>
              {revenueMonths.map((entry, index) => <Cell key={entry.month} fill={chartColors[index % chartColors.length]} />)}
            </Pie>
            <Tooltip formatter={currencyTooltip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#edf0f3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="money" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value, name) => name === t("returnsTotal") ? value : currencyTooltip(value)} />
            <Legend />
            <Bar dataKey="revenue" yAxisId="money" name={t("revenue")} fill="#16865b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="refunds" yAxisId="money" name={t("refunds")} fill="#d34c4c" radius={[3, 3, 0, 0]} />
            <Bar dataKey="returns" yAxisId="count" name={t("returnsTotal")} fill="#e7a53d" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthlyData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#edf0f3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="money" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value, name) => name === t("returnsTotal") ? value : currencyTooltip(value)} />
          <Legend />
          <Line type="monotone" dataKey="revenue" yAxisId="money" name={t("revenue")} stroke="#16865b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="refunds" yAxisId="money" name={t("refunds")} stroke="#d34c4c" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="returns" yAxisId="count" name={t("returnsTotal")} stroke="#e7a53d" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <>
      <PageHeader title={t("dashboard")} description={t("dashboardSub")} actions={
        <div className="page-actions">
          <Link href="/import" className="button button-secondary"><FileUp size={15} />{t("importData")}</Link>
          <Button onClick={loadDemo} disabled={busy}><ArrowDownToLine size={15} />{busy ? t("loading") : t("loadDemo")}</Button>
        </div>
      } />
      <ErrorMessage>{error}</ErrorMessage>
      {!hasData ? (
        <Card><EmptyState title={t("emptyTitle")} description={t("emptyText")} action={
          <div className="page-actions"><Link href="/import" className="button button-primary"><FileUp size={15} />{t("importFirst")}</Link><Button variant="secondary" onClick={loadDemo}><ArrowDownToLine size={15} />{t("loadDemo")}</Button></div>
        } /></Card>
      ) : (
        <>
          <div className="dashboard-kpis">
            <div><span>{t("revenue")}</span><strong>{formatMoney(revenueTotal, language)}</strong><small>{t("grossFromOrders")}</small></div>
            <div><span>{t("refunds")}</span><strong className={refundTotal ? "negative-value" : ""}>{formatMoney(refundTotal, language)}</strong><small>{t("refundsFromReports")}</small></div>
            <div><span>{t("returnRate")}</span><strong>{returns.returnRate === null ? "—" : `${(returns.returnRate * 100).toFixed(1)}%`}</strong><small>{returns.totalReturns} {t("returnsTotal").toLowerCase()}</small></div>
            <div><span>{t("orders")}</span><strong>{audit.orderCount.toLocaleString()}</strong><small>{imports.filter((item) => item.reportType === "orders").length} {t("ordersReport").toLowerCase()}</small></div>
          </div>
          <div className="dashboard-layout">
            <div className="dashboard-main">
              <Card className="dashboard-panel chart-panel">
                <div className="section-heading chart-heading">
                  <div><h2>{t("salesReturnsOverview")}</h2><p>{t("salesReturnsDescription")}</p></div>
                  <label className="chart-type-control"><span>{t("chartType")}</span><select value={chartType} onChange={(event) => setChartType(event.target.value)} aria-label={t("chartType")}>
                    <option value="line">{t("lineChart")}</option><option value="bar">{t("barChart")}</option><option value="pie">{t("pieChart")}</option>
                  </select></label>
                </div>
                <div className="dashboard-chart">{chartContent()}</div>
              </Card>
              <Card className="dashboard-panel ai-analysis-panel">
                <div className="section-heading">
                  <h2><Sparkles size={15} />{t("aiInventoryTitle")}</h2>
                  <Badge tone={aiStatus === "ready" ? "success" : "neutral"}>{aiStatus === "ready" ? "DeepSeek" : t("aiNotConfigured")}</Badge>
                </div>
                <div className="ai-analysis-content">
                  <p className="ai-analysis-description">{t("aiInventoryDescription")}</p>
                  <label className="field ai-context-field">
                    {t("marketSeasonContext")}
                    <input
                      type="text"
                      maxLength={200}
                      value={marketSeasonContext}
                      onChange={(event) => setMarketSeasonContext(event.target.value)}
                      placeholder={t("marketSeasonPlaceholder")}
                    />
                  </label>
                  {aiStatus === "missing" && <p className="ai-setup-note">{t("aiSetupHint")} <code>DEEPSEEK_API_KEY</code> {t("aiSetupHintEnd")}</p>}
                  {aiStatus === "unavailable" && <p className="ai-error" role="status">{t("aiStatusUnavailable")}</p>}
                  <Button onClick={analyzeInventory} disabled={aiStatus !== "ready" || aiBusy || !inventory.length}>
                    <Sparkles size={14} />{aiBusy ? t("aiAnalyzing") : t("analyzeWithAi")}
                  </Button>
                  <p className="analysis-disclaimer">{t("aiPrivacyDisclaimer")}</p>
                  {aiError && <p className="ai-error" role="alert">{aiError}</p>}
                  {aiAnalysis?.sourceSignature === inventorySignature && <div className="ai-result" aria-live="polite">
                    <p className="ai-summary">{aiAnalysis.summary}</p>
                    {aiAnalysis.recommendations.map((recommendation, index) => (
                      <article className="ai-recommendation" key={`${recommendation.title}-${index}`}>
                        <div><strong>{recommendation.title}</strong><Badge tone={recommendation.confidence === "high" ? "success" : "neutral"}>{t(`confidence${recommendation.confidence}`)}</Badge></div>
                        <p>{recommendation.action}</p>
                        <small>{t("aiEvidence")}: {recommendation.evidence}</small>
                      </article>
                    ))}
                  </div>}
                </div>
              </Card>
              <Card className="dashboard-panel">
                <div className="section-heading"><h2><TrendingUp size={15} />{t("inventoryAnalyst")}</h2><Badge tone="blue">{t("dataDriven")}</Badge></div>
                <div className="insight-list">
                  {inventory.length ? inventory.slice(0, 4).map((item) => (
                    <div className="insight-row" key={item.key}>
                      <span className={`insight-indicator insight-${item.tone}`} />
                      <div><strong>{item.name}</strong><p>{item.recommendation}</p>{item.sku && <small>SKU {item.sku}</small>}</div>
                      {item.change !== null && <Badge tone={item.change > 0 ? "success" : "neutral"}>{item.change > 0 ? "+" : ""}{Math.round(item.change * 100)}%</Badge>}
                    </div>
                  )) : <EmptyState title={t("noInventoryData")} description={t("inventoryImportHint")} action={<Link href="/import" className="text-link">{t("importData")} →</Link>} />}
                </div>
                <p className="analysis-disclaimer">{t("inventoryAnalysisDisclaimer")}</p>
              </Card>
              <Card className="dashboard-panel">
                <div className="section-heading"><h2><FileClock size={15} />{t("recentActivity")}</h2><Link href="/history">{t("history")} <ArrowRight size={13} /></Link></div>
                <div className="compact-activity">
                  {recentImports.map((item) => (
                    <div className="activity-row" key={item.id}>
                      <span className="activity-dot" /><strong>{item.fileName}</strong><span>{translateReport(t, item.reportType)}</span><time>{formatDate(item.importedAt, language)}</time>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <aside className="dashboard-side">
              <Card className="dashboard-panel">
                <div className="section-heading"><h2><PackageSearch size={15} />{t("recentReturns")}</h2><Link href="/returns">{t("viewAll")} <ArrowRight size={13} /></Link></div>
                {recentReturns.length ? <div className="recent-return-list">{recentReturns.map((row, index) => (
                  <Link href="/returns" className="recent-return-row" key={`${row._importId}-${row._rowIndex}`}>
                    <span className="return-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="recent-return-copy"><strong>{row.product || row.sku || row.orderId || t("unavailable")}</strong><small>{row.orderId || t("unavailable")} · {row.category}</small></span>
                    <time>{formatDate(row.date, language)}</time>
                  </Link>
                ))}</div> : <EmptyState title={t("noReturns")} description={t("importReturnsHint")} action={<Link href="/import" className="text-link">{t("importData")} →</Link>} />}
              </Card>
              <Card className="dashboard-panel">
                <div className="section-heading"><h2><AlertTriangle size={15} />{t("importantAlerts")}</h2></div>
                <div className="alert-list">
                  <Link href="/auditor" className="alert-row">
                    <span className={audit.discrepancyCount ? "alert-mark alert-warning" : "alert-mark alert-good"}><AlertTriangle size={14} /></span>
                    <span><strong>{audit.hasUsableOrders && audit.hasUsablePayments ? `${audit.discrepancyCount} ${t("discrepancies").toLowerCase()}` : t("financialReportsNeeded")}</strong><small>{audit.hasUsableOrders && audit.hasUsablePayments ? t("paymentCheckHint") : t("financialReportsHint")}</small></span>
                    <ArrowRight size={14} />
                  </Link>
                  {!imports.some((item) => item.reportType === "products") && <Link href="/import" className="alert-row">
                    <span className="alert-mark alert-neutral"><Box size={14} /></span><span><strong>{t("inventoryReportMissing")}</strong><small>{t("inventoryImportHint")}</small></span><ArrowRight size={14} />
                  </Link>}
                </div>
              </Card>
              <Card className="dashboard-panel">
                <div className="section-heading"><h2><ShoppingBag size={15} />{t("recentTransactions")}</h2><Link href="/auditor">{t("auditor")} <ArrowRight size={13} /></Link></div>
                {latestTransactions.length ? <div className="transaction-list">{latestTransactions.map((row, index) => (
                  <div className="transaction-row" key={`${row.orderId}-${row.date}-${index}`}><div><strong>{row.orderId || t("unavailable")}</strong><small>{row.transactionType || t("payment")}</small></div><span className={row.amount < 0 ? "negative-value" : ""}>{formatMoney(row.amount ?? row.refund ?? row.fee, language)}</span></div>
                ))}</div> : <p className="panel-empty">{t("noTransactions")}</p>}
              </Card>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
