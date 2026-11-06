"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, ExternalLink, Search, X } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, StatCard, formatDate, formatMoney } from "@/components/ui";
import { calculateReturns, categorizeReturn, makeCsv } from "@/lib/data";

const chartColors = ["#16865b", "#d34c4c", "#e7a53d", "#5273bd", "#8b70b4", "#52a5a0", "#87929d", "#bf8b58"];
const sortOptions = ["newest", "oldest", "refundHigh", "refundLow"];

function safeMarketplaceUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function provided(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export default function ReturnsPage() {
  const { imports, language, t, save } = useApp();
  const [saveError, setSaveError] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [product, setProduct] = useState("all");
  const [reason, setReason] = useState("all");
  const [status, setStatus] = useState("all");
  const [marketplace, setMarketplace] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [chartType, setChartType] = useState("pie");
  const [chartCategory, setChartCategory] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const analysis = calculateReturns(imports);
  const records = analysis.records;

  const productOptions = [...new Set(records.map((row) => row.product || row.sku).filter(Boolean))].sort();
  const reasonOptions = [...new Set(records.map((row) => row.category))].sort();
  const statusOptions = [...new Set(records.map((row) => row.status).filter(provided))].sort();
  const marketplaceOptions = [...new Set(records.map((row) => row.marketplace).filter(provided))].sort();

  const baseFiltered = records.filter((row) => {
    const searchText = `${row.orderId || ""} ${row.returnId || ""} ${row.product || ""}`.toLowerCase();
    return searchText.includes(query.toLowerCase())
      && (!dateFrom || Boolean(row.date && row.date >= dateFrom))
      && (!dateTo || Boolean(row.date && row.date <= dateTo))
      && (product === "all" || (row.product || row.sku) === product)
      && (reason === "all" || row.category === reason)
      && (status === "all" || row.status === status)
      && (marketplace === "all" || row.marketplace === marketplace);
  });
  const categoryCounts = [...baseFiltered.reduce((counts, row) => counts.set(row.category, (counts.get(row.category) || 0) + 1), new Map())]
    .map(([name, value], index) => ({ name, label: t(`categories.${name}`), value, index }))
    .sort((first, second) => second.value - first.value);
  const filtered = baseFiltered.filter((row) => !chartCategory || row.category === chartCategory).sort((first, second) => {
    if (sortBy === "oldest") return (first.date || "").localeCompare(second.date || "");
    if (sortBy === "refundHigh") return Math.abs(second.refund ?? 0) - Math.abs(first.refund ?? 0);
    if (sortBy === "refundLow") return Math.abs(first.refund ?? 0) - Math.abs(second.refund ?? 0);
    return (second.date || "").localeCompare(first.date || "");
  });
  const selectedReturn = selectedKey ? records.find((row) => `${row._importId}:${row._rowIndex}` === selectedKey) : null;
  const associatedFeedback = selectedReturn?.orderId
    ? imports.filter((item) => item.reportType === "feedback").flatMap((item) => item.rows)
      .find((row) => row.orderId === selectedReturn.orderId && provided(row.customerFeedback || row.comment))
    : null;
  const fullFeedback = selectedReturn?.customerFeedback || selectedReturn?.comment || associatedFeedback?.customerFeedback || associatedFeedback?.comment || "";
  const hasLongFeedback = provided(selectedReturn?.customerFeedback || selectedReturn?.comment || associatedFeedback?.customerFeedback || associatedFeedback?.comment);
  const conversationUrl = safeMarketplaceUrl(selectedReturn?.marketplaceConversationUrl);
  const accountUrl = safeMarketplaceUrl(selectedReturn?.marketplaceAccountUrl);
  const hasContactMethod = [selectedReturn?.customerPhone, selectedReturn?.customerEmail, selectedReturn?.customerTelegram].some(provided);

  async function editCategory(row, nextCategory) {
    const updatedImports = imports.map((item) => {
      if (item.id !== row._importId) return item;
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

  function chooseChartCategory(name) {
    setChartCategory((current) => current === name ? "" : name);
    setSelectedKey("");
  }

  function handlePieClick(event) {
    const sector = event.target.closest?.(".recharts-pie-sector path");
    const category = sector?.getAttribute("name");
    if (category) chooseChartCategory(category);
  }

  function exportRows() {
    const rows = filtered.map((row) => ({
      [t("returnId")]: row.returnId || "",
      [t("orderId")]: row.orderId || "",
      [t("product")]: row.product || row.sku || "",
      [t("quantity")]: row.quantity ?? "",
      [t("date")]: row.date || "",
      [t("reason")]: row.returnReason || row.customerFeedback || row.comment || "",
      [t("category")]: t(`categories.${row.category}`),
      [t("refund")]: row.refund ?? "",
      [t("status")]: row.status || "",
      [t("fullFeedback")]: row.customerFeedback || row.comment || "",
    }));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([makeCsv(rows)], { type: "text/csv;charset=utf-8" }));
    link.download = "returns-investigation.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function renderChart() {
    if (!categoryCounts.length) return <EmptyState title={t("noRows")} description={t("chartImportHint")} />;
    const clickCategory = (entry) => {
      const name = entry?.payload?.name || entry?.name || "";
      if (name) chooseChartCategory(name);
    };
    if (chartType === "pie") {
      return <ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={categoryCounts} dataKey="value" nameKey="label" innerRadius={52} outerRadius={90} paddingAngle={2} style={{ cursor: "pointer" }}>
          {categoryCounts.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
        </Pie><Tooltip formatter={(value) => [value, t("records")]} /><Legend />
      </PieChart></ResponsiveContainer>;
    }
    return <ResponsiveContainer width="100%" height="100%"><BarChart data={categoryCounts} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
      <CartesianGrid stroke="#edf0f3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
      <Tooltip /><Legend /><Bar dataKey="value" name={t("records")} fill="#16865b" radius={[3, 3, 0, 0]} onClick={clickCategory} cursor="pointer">
        {categoryCounts.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
      </Bar>
    </BarChart></ResponsiveContainer>;
  }

  const currency = new Intl.NumberFormat(language === "ru" ? "ru-RU" : language === "uz" ? "uz-UZ" : "en-US", { style: "percent", maximumFractionDigits: 1 });
  const activeCategory = chartCategory ? t(`categories.${chartCategory}`) : "";

  return (
    <>
      <PageHeader title={t("returnsTitle")} description={t("returnsSub")} actions={<Button variant="secondary" disabled={!filtered.length} onClick={exportRows}><Download size={15} />{t("export")}</Button>} />
      <ErrorMessage>{saveError}</ErrorMessage>
      {!records.length ? <Card><EmptyState title={t("noReturns")} description={t("noReturns")} action={<a href="/import" className="button button-primary">{t("importFirst")}</a>} /></Card> : (
        <>
          <div className="returns-kpis">
            <StatCard label={t("returnCount")} value={analysis.totalReturns.toLocaleString()} note={`${records.length} ${t("records").toLowerCase()}`} />
            <StatCard label={t("returnRate")} value={analysis.returnRate === null ? "—" : currency.format(analysis.returnRate)} note={analysis.returnRate === null ? t("returnRateUnavailable") : `${analysis.returnedOrderCount} / ${analysis.orderCount} ${t("orders").toLowerCase()}`} />
            <StatCard label={t("topProducts")} value={analysis.productCounts[0]?.name || "—"} note={analysis.productCounts[0] ? `${analysis.productCounts[0].count} ${t("returnsTotal").toLowerCase()}` : ""} />
            <StatCard label={t("reasonBreakdown")} value={analysis.categoryCounts.length.toLocaleString()} />
          </div>
          <Card className="returns-chart-panel">
            <div className="section-heading chart-heading">
              <div><h2>{t("reasonBreakdown")}</h2><p>{t("clickReasonHint")}</p></div>
              <label className="chart-type-control"><span>{t("chartType")}</span><select value={chartType} onChange={(event) => setChartType(event.target.value)} aria-label={t("chartType")}>
                <option value="pie">{t("pieChart")}</option><option value="bar">{t("barChart")}</option>
              </select></label>
            </div>
            <div className="returns-chart" onClick={chartType === "pie" ? handlePieClick : undefined}>{renderChart()}</div>
            {chartCategory && <div className="active-filter-chip">{t("selectedReason")}: <strong>{activeCategory}</strong><button onClick={() => setChartCategory("")} aria-label={t("clearFilter")}><X size={13} /></button></div>}
          </Card>
          <Card className="section-card returns-workspace">
            <div className="section-heading"><h2>{t("returnsTitle")}</h2><Badge tone="neutral">{filtered.length} {t("records").toLowerCase()}</Badge></div>
            <div className="returns-filters">
              <label className="field search-field"><Search size={15} /><span className="sr-only">{t("returnSearch")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("returnSearch")} /></label>
              <label className="field">{t("dateFrom")}<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="field">{t("dateTo")}<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
              <label className="field">{t("productFilter")}<select value={product} onChange={(event) => setProduct(event.target.value)}><option value="all">{t("all")}</option>{productOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="field">{t("reasonFilter")}<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="all">{t("all")}</option>{reasonOptions.map((item) => <option key={item} value={item}>{t(`categories.${item}`)}</option>)}</select></label>
              <label className="field">{t("returnStatusFilter")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("all")}</option>{statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="field">{t("marketplaceFilter")}<select value={marketplace} onChange={(event) => setMarketplace(event.target.value)}><option value="all">{t("all")}</option>{marketplaceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="field">{t("sortBy")}<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{sortOptions.map((item) => <option value={item} key={item}>{t(item === "newest" ? "newestFirst" : item === "oldest" ? "oldestFirst" : item === "refundHigh" ? "highestRefund" : "lowestRefund")}</option>)}</select></label>
            </div>
            {filtered.length ? <div className="data-table-wrap"><table className="data-table returns-table">
              <thead><tr><th>{t("returnId")}</th><th>{t("orderId")}</th><th>{t("product")}</th><th>{t("date")}</th><th>{t("reason")}</th><th>{t("category")}</th><th>{t("refund")}</th><th>{t("status")}</th><th /></tr></thead>
              <tbody>{filtered.map((row) => <tr key={`${row._importId}-${row._rowIndex}`}>
                <td className="table-primary">{row.returnId || t("unavailable")}</td><td>{row.orderId || t("unavailable")}</td><td>{row.product || row.sku || t("unavailable")}</td><td>{formatDate(row.date, language)}</td>
                <td className="return-reason-cell">{row.returnReason || row.customerFeedback || row.comment || t("unavailable")}</td><td><Badge tone="neutral">{t(`categories.${row.category}`)}</Badge></td>
                <td>{Number.isFinite(row.refund) ? formatMoney(Math.abs(row.refund), language) : "—"}</td><td>{provided(row.status) ? <Badge tone="neutral">{row.status}</Badge> : t("notProvided")}</td>
                <td><button className="text-link" onClick={() => setSelectedKey(`${row._importId}:${row._rowIndex}`)}>{t("details")} →</button></td>
              </tr>)}</tbody>
            </table></div> : <EmptyState title={t("noRows")} description="" />}
          </Card>
          {selectedReturn && <Card className="return-detail-panel">
            <div className="section-heading"><div><h2>{t("returnInformation")} · {selectedReturn.returnId || selectedReturn.orderId || t("unavailable")}</h2><p>{selectedReturn.product || selectedReturn.sku || t("unavailable")}</p></div><button className="icon-button" onClick={() => setSelectedKey("")} aria-label={t("close")}><X size={17} /></button></div>
            <div className="return-detail-grid">
              <section><h3>{t("returnInformation")}</h3><dl className="detail-list">
                <dt>{t("returnId")}</dt><dd>{selectedReturn.returnId || t("notProvided")}</dd>
                <dt>{t("orderId")}</dt><dd>{selectedReturn.orderId || t("notProvided")}</dd>
                <dt>{t("product")}</dt><dd>{selectedReturn.product || t("notProvided")}</dd>
                <dt>SKU</dt><dd>{selectedReturn.sku || t("notProvided")}</dd>
                <dt>{t("quantity")}</dt><dd>{selectedReturn.quantity ?? t("notProvided")}</dd>
                <dt>{t("date")}</dt><dd>{formatDate(selectedReturn.date, language)}</dd>
                <dt>{t("refund")}</dt><dd>{Number.isFinite(selectedReturn.refund) ? formatMoney(Math.abs(selectedReturn.refund), language) : t("notProvided")}</dd>
                <dt>{t("status")}</dt><dd>{selectedReturn.status || t("notProvided")}</dd>
                <dt>{t("category")}</dt><dd>{t(`categories.${selectedReturn.category || categorizeReturn(selectedReturn.returnReason)}`)}</dd>
                <dt>{t("editCategory")}</dt><dd><select className="select" value={selectedReturn.category || categorizeReturn(selectedReturn.returnReason)} onChange={(event) => editCategory(selectedReturn, event.target.value)} aria-label={t("editCategory")}>{["Incorrect size", "Damaged product", "Packaging issue", "Missing accessories", "Incorrect description", "Wrong item", "Other", "Unknown"].map((item) => <option key={item} value={item}>{t(`categories.${item}`)}</option>)}</select></dd>
              </dl></section>
              <section><h3>{t("fullFeedback")}</h3><div className="feedback-copy">{hasLongFeedback ? fullFeedback : selectedReturn.returnReason || t("notProvided")}</div>{!hasLongFeedback && <p className="feedback-note">{t("noLongerFeedback")}</p>}</section>
              <section><h3>{t("customerInformation")}</h3><dl className="detail-list">
                <dt>{t("customerName")}</dt><dd>{selectedReturn.customerName || t("notProvided")}</dd>
                <dt>{t("customerId")}</dt><dd>{selectedReturn.customerId || t("notProvided")}</dd>
                <dt>{t("customerPhone")}</dt><dd>{provided(selectedReturn.customerPhone) ? <a href={`tel:${selectedReturn.customerPhone}`} className="text-link">{selectedReturn.customerPhone}</a> : t("notProvided")}</dd>
                <dt>{t("customerEmail")}</dt><dd>{provided(selectedReturn.customerEmail) ? <a href={`mailto:${selectedReturn.customerEmail}`} className="text-link">{selectedReturn.customerEmail}</a> : t("notProvided")}</dd>
                <dt>{t("customerTelegram")}</dt><dd>{selectedReturn.customerTelegram || t("notProvided")}</dd>
                <dt>{t("marketplace")}</dt><dd>{selectedReturn.marketplace || t("notProvided")}</dd>
                <dt>{t("marketplaceReference")}</dt><dd>{[selectedReturn.orderId, selectedReturn.returnId].filter(provided).join(" / ") || t("notProvided")}</dd>
              </dl>
                {conversationUrl ? <a className="button button-primary marketplace-link" href={conversationUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />{t("openMarketplaceConversation")}</a>
                  : <button className="button button-secondary marketplace-link" type="button" disabled title={t("noConversationLink")}><ExternalLink size={14} />{t("openMarketplaceConversation")}</button>}
                {!hasContactMethod && accountUrl && <a className="button button-secondary marketplace-link" href={accountUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />{t("openMarketplaceAccount")}</a>}
                {!conversationUrl && <p className="feedback-note">{t("noConversationLink")}</p>}
              </section>
            </div>
          </Card>}
        </>
      )}
    </>
  );
}
