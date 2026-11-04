"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Search } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, formatDate } from "@/components/ui";
import { calculateReturns, categorizeReturn, makeCsv } from "@/lib/data";

const returnCategories = ["Incorrect size", "Damaged product", "Packaging issue", "Missing accessories", "Incorrect description", "Wrong item", "Other", "Unknown"];
const chartColors = ["#3567d6", "#61a67d", "#e7a644", "#8c78bd", "#df7272", "#58a6a6", "#9aa3b1", "#c5a06e"];

export default function ReturnsPage() {
  const { imports, language, t, save } = useApp();
  const [saveError, setSaveError] = useState("");
  const returnReports = imports.filter((item) => item.reportType === "returns");
  const orderReports = imports.filter((item) => item.reportType === "orders");
  const feedbackReports = imports.filter((item) => item.reportType === "feedback");
  const [returnId, setReturnId] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [feedbackId, setFeedbackId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const selectedReturn = returnReports.find((item) => item.id === returnId) || returnReports[0];
  const selectedOrder = orderId === null ? orderReports[0] : orderReports.find((item) => item.id === orderId);
  const selectedFeedback = feedbackId ? feedbackReports.find((item) => item.id === feedbackId) : null;
  const selected = [selectedReturn, selectedOrder, selectedFeedback].filter(Boolean);
  const analysis = calculateReturns(selected);
  const filtered = analysis.records.filter((row) =>
    `${row.orderId || ""} ${row.product || ""} ${row.sku || ""}`.toLowerCase().includes(query.toLowerCase())
    && (category === "all" || row.category === category),
  );

  async function editCategory(row, nextCategory) {
    if (!selectedReturn) return;
    const updatedImports = imports.map((item) => {
      if (item.id !== selectedReturn.id) return item;
      const rows = item.rows.map((record, index) => index === row._rowIndex ? { ...record, category: nextCategory } : record);
      return { ...item, rows };
    });
    try {
      setSaveError("");
      await save(updatedImports);
    } catch (error) {
      setSaveError(error.message);
    }
  }

  const currency = new Intl.NumberFormat(language === "ru" ? "ru-RU" : language === "uz" ? "uz-UZ" : "en-US", { style: "percent", maximumFractionDigits: 1 });
  const recommendation = analysis.productCounts[0]
    ? t("recommendationSentence").replace("{product}", analysis.productCounts[0].name).replace("{count}", String(analysis.productCounts[0].count))
    : "";

  function exportRows() {
    const rows = filtered.map((row) => ({
      [t("orderId")]: row.orderId,
      [t("product")]: row.product || row.sku,
      [t("quantity")]: row.quantity ?? 1,
      [t("date")]: row.date,
      [t("reason")]: row.returnReason,
      [t("category")]: t(`categories.${row.category}`),
    }));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([makeCsv(rows)], { type: "text/csv;charset=utf-8" }));
    link.download = "returns-investigation.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  return (
    <>
      <PageHeader title={t("returnsTitle")} description={t("returnsSub")} actions={<Button variant="secondary" disabled={!filtered.length} onClick={exportRows}><Download size={15} />{t("export")}</Button>} />
      <Card className="section-card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <label className="field">{t("returnsReport")}
            <select value={selectedReturn?.id || ""} onChange={(event) => setReturnId(event.target.value)} required>
              {returnReports.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
            </select>
          </label>
          <label className="field">{t("orderFile")}
            <select value={selectedOrder?.id || ""} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">{t("none")}</option>
              {orderReports.map((item) => <option key={item.id} value={item.id}>{item.fileName} · {formatDate(item.importedAt, language)}{item.isDemo ? ` · ${t("demo")}` : ""}</option>)}
            </select>
          </label>
          <label className="field">{t("feedback")}
            <select value={selectedFeedback?.id || ""} onChange={(event) => setFeedbackId(event.target.value)}>
              <option value="">{t("none")}</option>
              {feedbackReports.map((item) => <option key={item.id} value={item.id}>{item.fileName} · {formatDate(item.importedAt, language)}{item.isDemo ? ` · ${t("demo")}` : ""}</option>)}
            </select>
          </label>
        </div>
      </Card>
      {!selectedReturn ? <Card><EmptyState title={t("noReturns")} description={t("noReturns")} /></Card> : (
        <>
          {saveError && <div className="message message-error" role="alert">{saveError}</div>}
          <div className="stat-grid">
            <StatCard label={t("returnCount")} value={analysis.totalReturns.toLocaleString()} />
            <StatCard label={t("returnRate")} value={analysis.returnRate === null ? "—" : currency.format(analysis.returnRate)} note={analysis.returnRate === null ? t("returnRateUnavailable") : `${analysis.returnedOrderCount} ${t("ordersWithReturns").toLowerCase()} / ${analysis.orderCount} ${t("orders").toLowerCase()}`} />
            <StatCard label={t("topProducts")} value={analysis.productCounts[0]?.name || "—"} note={analysis.productCounts[0] ? `${analysis.productCounts[0].count} ${t("returnsTotal").toLowerCase()}` : ""} />
            <StatCard label={t("reasonBreakdown")} value={analysis.categoryCounts.length.toLocaleString()} />
          </div>
          <div className="analysis-grid">
            <Card className="chart-card"><h2>{t("reasonBreakdown")}</h2><div className="chart-area">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analysis.categoryCounts} dataKey="value" nameKey="name" outerRadius={78} innerRadius={45} paddingAngle={2}>
                {analysis.categoryCounts.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
              </Pie><Tooltip /></PieChart></ResponsiveContainer>
            </div>
              {analysis.categoryCounts.map((item, index) => <span className="chart-legend" key={item.name} style={{ color: chartColors[index % chartColors.length] }}>{t(`categories.${item.name}`)} · {item.value}</span>)}
            </Card>
            <Card className="chart-card"><h2>{t("trend")}</h2><div className="chart-area">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={analysis.trendCounts} margin={{ top: 5, right: 12, bottom: 3, left: -20 }}>
                <CartesianGrid stroke="#edf0f3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="returns" fill="#3567d6" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div></Card>
          </div>
          {recommendation && <div className="info-box" style={{ marginBottom: 16 }}><strong>{t("recommendation")}:</strong> {recommendation}</div>}
          {analysis.feedbackCount > 0 && <div className="info-box" style={{ marginBottom: 16 }}>{t("feedback")}: {analysis.feedbackCount} {t("records").toLowerCase()} · {analysis.feedbackPatterns.map((item) => `${t(`categories.${item.name}`)} ${item.count}`).join(" · ")}</div>}
          <Card className="section-card">
            <div className="section-heading"><h2>{t("returnsTitle")}</h2><Badge tone="neutral">{filtered.length} {t("records").toLowerCase()}</Badge></div>
            <div className="toolbar">
              <label className="field search-field"><Search size={15} /><span className="sr-only">{t("returnSearch")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("returnSearch")} /></label>
              <label className="field">{t("categoryFilter")}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{t("all")}</option>{returnCategories.map((item) => <option key={item} value={item}>{t(`categories.${item}`)}</option>)}</select></label>
            </div>
            {filtered.length ? <div className="data-table-wrap"><table className="data-table">
              <thead><tr><th>{t("orderId")}</th><th>{t("product")}</th><th>{t("date")}</th><th>{t("reason")}</th><th>{t("category")}</th><th>{t("editCategory")}</th></tr></thead>
              <tbody>{filtered.map((row, index) => <tr key={`${row.orderId}-${row.date}-${index}`}><td className="table-primary">{row.orderId || "—"}</td><td>{row.product || row.sku || "—"}</td><td>{row.date || "—"}</td><td>{row.returnReason || "—"}</td><td><Badge tone="neutral">{t(`categories.${row.category}`)}</Badge></td>
                <td><select className="select" value={row.category || categorizeReturn(row.returnReason)} onChange={(event) => editCategory(row, event.target.value)} aria-label={`${t("editCategory")} ${row.orderId}`} style={{ maxWidth: 170 }}>
                  {returnCategories.map((item) => <option key={item} value={item}>{t(`categories.${item}`)}</option>)}
                </select></td></tr>)}</tbody>
            </table></div> : <EmptyState title={t("noRows")} description="" />}
          </Card>
        </>
      )}
    </>
  );
}
