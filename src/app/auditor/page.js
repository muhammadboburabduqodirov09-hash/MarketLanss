"use client";

import { useState } from "react";
import { Download, Search } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, StatCard, formatDate, formatMoney } from "@/components/ui";
import { calculatePaymentAudit, escapeCsv } from "@/lib/data";

const statusKey = {
  matched: "matchedStatus",
  possible_duplicate: "duplicateStatus",
  unexplained_difference: "unexplainedStatus",
  unmatched: "unmatchedStatus",
  partially_matched: "partialStatus",
  timing_difference: "timingDifference",
  fee: "feeStatus",
  refund: "refundStatus",
};

function badgeTone(status) {
  if (status === "matched") return "success";
  if (status === "possible_duplicate" || status === "timing_difference") return "warning";
  if (status === "unmatched") return "neutral";
  return "danger";
}

function exportRows(rows, t) {
  const headers = [
    ["orderId", t("orderId")],
    ["gross", t("gross")],
    ["expected", t("expectedAmount")],
    ["actual", t("actualAmount")],
    ["difference", t("differenceAmount")],
    ["status", t("status")],
  ];
  const content = [
    headers.map(([, label]) => escapeCsv(label)).join(","),
    ...rows.map((row) => headers.map(([key]) => escapeCsv(key === "status" ? t(statusKey[row.status] || "unexplainedStatus") : row[key])).join(",")),
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  link.download = "payment-investigation.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function AuditorPage() {
  const { imports, t, language } = useApp();
  const orderReports = imports.filter((item) => item.reportType === "orders");
  const paymentReports = imports.filter((item) => item.reportType === "payments");
  const [orderId, setOrderId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const orderReport = orderReports.find((item) => item.id === orderId) || orderReports[0];
  const paymentReport = paymentReports.find((item) => item.id === paymentId) || paymentReports[0];
  const relevantImports = [orderReport, paymentReport].filter(Boolean);
  const audit = calculatePaymentAudit(relevantImports);
  const filtered = audit.rows.filter((row) =>
    row.orderId.toLowerCase().includes(query.toLowerCase())
    && (status === "all" || row.status === status || (["fee", "refund"].includes(status) && row.transactions.some((txn) => (txn.transactionType || "payment") === status))),
  );
  const enoughData = audit.hasUsableOrders && audit.hasUsablePayments;

  return (
    <>
      <PageHeader title={t("auditTitle")} description={t("auditSub")} actions={
        <Button variant="secondary" disabled={!filtered.length} onClick={() => exportRows(filtered, t)}><Download size={15} />{t("export")}</Button>
      } />
      {(!orderReport || !paymentReport) && <ErrorMessage>{t("importRequired")}</ErrorMessage>}
      {orderReport && paymentReport && !enoughData && <ErrorMessage>{t("noFinanceData")}</ErrorMessage>}
      <Card className="section-card">
        <div className="toolbar">
          <label className="field">{t("orderFile")}
            <select value={orderReport?.id || ""} onChange={(event) => setOrderId(event.target.value)} required>
              {orderReports.map((item) => <option key={item.id} value={item.id}>{item.fileName} · {formatDate(item.importedAt, language)}{item.isDemo ? ` · ${t("demo")}` : ""}</option>)}
            </select>
          </label>
          <label className="field">{t("paymentFile")}
            <select value={paymentReport?.id || ""} onChange={(event) => setPaymentId(event.target.value)} required>
              {paymentReports.map((item) => <option key={item.id} value={item.id}>{item.fileName} · {formatDate(item.importedAt, language)}{item.isDemo ? ` · ${t("demo")}` : ""}</option>)}
            </select>
          </label>
        </div>
        {enoughData && (
          <>
            <div className="section-body" style={{ paddingBottom: 0 }}>
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <StatCard label={t("expected")} value={formatMoney(audit.expectedTotal, language)} />
                <StatCard label={t("actual")} value={formatMoney(audit.actualTotal, language)} />
                <StatCard label={t("difference")} value={formatMoney(audit.differenceTotal, language)} />
                <StatCard label={t("matched")} value={audit.matchedCount.toLocaleString()} note={`${audit.discrepancyCount} ${t("flagged").toLowerCase()}`} />
              </div>
              <div className="info-box"><strong>{t("calculation")}:</strong> {t("calculationText")} {t("currencyNote")}</div>
            </div>
            <div className="toolbar">
              <label className="field search-field"><Search size={15} /><span className="sr-only">{t("orderSearch")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("orderSearch")} /></label>
              <label className="field">{t("statusFilter")}
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">{t("all")}</option>
                  {Object.entries(statusKey).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
                </select>
              </label>
            </div>
            {filtered.length ? <div className="data-table-wrap"><table className="data-table">
              <thead><tr><th>{t("orderId")}</th><th>{t("expectedAmount")}</th><th>{t("actualAmount")}</th><th>{t("differenceAmount")}</th><th>{t("status")}</th><th /></tr></thead>
              <tbody>{filtered.map((row, index) => <tr key={`${row.orderId}-${index}`}>
                <td className="table-primary">{row.orderId}</td><td>{formatMoney(row.expected, language)}</td><td>{formatMoney(row.actual, language)}</td><td>{formatMoney(row.difference, language)}</td>
                <td><Badge tone={badgeTone(row.status)}>{t(statusKey[row.status] || "unexplainedStatus")}</Badge></td>
                <td><button className="text-link" onClick={() => setSelected(selected === `${row.orderId}-${index}` ? null : `${row.orderId}-${index}`)}>{t("details")}</button></td>
              </tr>)}</tbody>
            </table></div> : <EmptyState title={t("noRows")} description="" />}
            {selected && (() => {
              const rowIndex = filtered.findIndex((row, index) => `${row.orderId}-${index}` === selected);
              const row = filtered[rowIndex];
              return row ? <div className="detail-panel"><h3>{t("transactionDetails")} · {row.orderId}</h3>
                <p>{t("expectedAmount")}: <strong>{formatMoney(row.expected, language)}</strong></p><p>{t("actualAmount")}: <strong>{formatMoney(row.actual, language)}</strong></p>
                {row.transactions.map((transaction, index) => <p key={index}>{transaction.date || "—"} · {t(`transactionTypes.${transaction.transactionType || "payment"}`)} · {formatMoney(transaction.amount ?? transaction.fee ?? transaction.refund, language)}</p>)}
                {row.status === "possible_duplicate" && <p>{t("duplicateStatus")}: multiple payment transactions share this order ID.</p>}
              </div> : null;
            })()}
          </>
        )}
      </Card>
    </>
  );
}
