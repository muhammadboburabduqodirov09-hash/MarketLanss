"use client";

import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, formatDate } from "@/components/ui";
import { reportLabels } from "@/lib/data";
import { translateReport } from "@/lib/translations";
import { warningText } from "@/lib/warnings";

export default function HistoryPage() {
  const { imports, t, language, save } = useApp();
  const [query, setQuery] = useState("");
  const [reportType, setReportType] = useState("all");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const rows = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).filter((item) =>
    item.fileName.toLowerCase().includes(query.toLowerCase()) && (reportType === "all" || item.reportType === reportType),
  );

  async function remove(item) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      setError("");
      await save(imports.filter((entry) => entry.id !== item.id));
      if (selected === item.id) setSelected(null);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <>
      <PageHeader title={t("historyTitle")} description={t("historySub")} />
      <ErrorMessage>{error}</ErrorMessage>
      <Card className="section-card">
        <div className="toolbar">
          <label className="field search-field"><Search size={15} /><span className="sr-only">{t("search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /></label>
          <label className="field">{t("reportType")}<select value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="all">{t("all")}</option>{Object.entries(reportLabels).map(([value]) => <option value={value} key={value}>{translateReport(t, value)}</option>)}</select></label>
        </div>
        {!rows.length ? <EmptyState title={imports.length ? t("noRows") : t("noImports")} description="" /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>{t("file")}</th><th>{t("reportType")}</th><th>{t("date")}</th><th>{t("records")}</th><th>{t("status")}</th><th>{t("warnings")}</th><th>{t("actions")}</th></tr></thead>
          <tbody>{rows.map((item) => <tr key={item.id}>
            <td className="table-primary">{item.fileName}</td><td>{translateReport(t, item.reportType)}</td><td>{formatDate(item.importedAt, language)}</td><td>{item.rows.length.toLocaleString()}</td>
            <td><Badge tone={item.isDemo ? "blue" : "success"}>{item.isDemo ? t("demo") : t("imported")}</Badge></td>
            <td>{item.warnings.length ? <Badge tone="warning">{item.warnings.length} {t("warnings").toLowerCase()}</Badge> : "—"}</td>
            <td><div className="page-actions"><button className="text-link" onClick={() => setSelected(selected === item.id ? null : item.id)}>{selected === item.id ? t("close") : t("details")}</button><Button variant="danger" className="icon-only-button" onClick={() => remove(item)} aria-label={`${t("delete")} ${item.fileName}`}><Trash2 size={14} /></Button></div></td>
          </tr>)}</tbody>
        </table></div>}
        {selected && imports.some((item) => item.id === selected) && (() => {
          const item = imports.find((entry) => entry.id === selected);
          return <div className="detail-panel"><h3>{item.fileName}</h3>
            <p>{t("reportType")}: {translateReport(t, item.reportType)} · {item.rows.length} {t("records").toLowerCase()}</p>
            <p>{t("date")}: {formatDate(item.importedAt, language)}</p>
            {item.warnings.map((warning, index) => <p key={index}>{t("warnings")}: {warningText(warning, t)}</p>)}
            <p>{t("sourceRowsRetained")}</p>
            {item.rows[0]?.original && <pre className="original-row">{JSON.stringify(item.rows[0].original, null, 2)}</pre>}
          </div>;
        })()}
      </Card>
    </>
  );
}
