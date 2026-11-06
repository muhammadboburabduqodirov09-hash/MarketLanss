"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileUp, LoaderCircle } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, ErrorMessage, PageHeader, SuccessMessage } from "@/components/ui";
import { analyzeColumnTypes, fields, inspectRows, mapRows, parseUpload, recognizeColumns, reportTypes } from "@/lib/data";
import { translateField, translateReport } from "@/lib/translations";

const requiredField = { orders: "orderId", payments: "orderId", products: "product", feedback: "comment" };

function translateFileError(error, t) {
  const message = error.message || "";
  if (message.startsWith("Choose a CSV")) return t("typeError");
  if (message.startsWith("Files must be")) return t("sizeError");
  if (message.startsWith("Files may contain")) return t("rowLimitError");
  if (message.includes("no usable data rows")) return t("noDataRowsError");
  if (message.includes("needs a header row")) return t("headerError");
  if (message.startsWith("Could not parse CSV")) return t("csvParseError");
  if (message.includes("no readable worksheets")) return t("worksheetError");
  return message;
}

export default function ImportPage() {
  const { imports, t, save, notify } = useApp();
  const fileInput = useRef(null);
  const [reportType, setReportType] = useState("orders");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mappings, setMappings] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [problemRowsOnly, setProblemRowsOnly] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);

  const mappedRows = useMemo(() => parsed ? mapRows(parsed.rows, mappings) : [], [parsed, mappings]);
  const inspection = useMemo(() => parsed ? inspectRows(parsed.rows, mappedRows, reportType) : null, [parsed, mappedRows, reportType]);
  const columnTypes = useMemo(() => parsed ? analyzeColumnTypes(parsed.rows) : {}, [parsed]);
  const usedFields = Object.values(mappings).filter(Boolean);
  const previewIndexes = parsed && inspection
    ? Array.from({ length: inspection.rowCount }, (_, index) => index).filter((index) =>
      !problemRowsOnly || inspection.invalidIndexes.includes(index) || inspection.duplicateIndexes.includes(index),
    )
    : [];
  const pageSize = 20;
  const previewRows = previewIndexes.slice(previewPage * pageSize, (previewPage + 1) * pageSize);

  async function analyze(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!file) return setError(t("noFile"));
    setBusy(true);
    try {
      const result = await parseUpload(file);
      setParsed(result);
      setMappings(Object.fromEntries(recognizeColumns(result.headers).map(({ header, field }) => [header, field])));
      setProblemRowsOnly(false);
      setPreviewPage(0);
    } catch (parseError) {
      setParsed(null);
      setError(translateFileError(parseError, t));
    } finally {
      setBusy(false);
    }
  }

  function changeReportType(value) {
    setReportType(value);
    setParsed(null);
    setSuccess("");
  }

  async function confirmImport() {
    setError("");
    setSuccess("");
    const mandatory = requiredField[reportType];
    const mappedFields = Object.values(mappings);
    if (reportType === "returns") {
      if (!mappedFields.includes("orderId")) return setError(t("noOrderId"));
      if (!mappedFields.some((field) => ["returnReason", "customerFeedback", "comment"].includes(field))) return setError(t("noReturnReason"));
    } else if (!mappedFields.includes(mandatory)) return setError(t("noOrderId"));
    if (reportType === "payments" && !Object.values(mappings).includes("amount")) return setError(t("mapPaymentAmount"));
    if (reportType === "orders" && !Object.values(mappings).some((field) => ["amount", "unitPrice"].includes(field))) return setError(t("mapOrderAmount"));
    setBusy(true);
    try {
      const mapped = mapRows(parsed.rows, mappings).map((row, index) => ({ ...row, original: parsed.rows[index] }));
      const warnings = [];
      if (parsed.parseWarnings?.length) warnings.push({ key: "csvParseWarnings", count: parsed.parseWarnings.length });
      if (inspection.invalidIndexes.length) warnings.push({ key: "droppedRowsWarning", count: inspection.invalidIndexes.length });
      if (inspection.duplicateIndexes.length) warnings.push({ key: "duplicateRowsWarning", count: inspection.duplicateIndexes.length });
      const unmapped = Object.entries(mappings).filter(([, field]) => !field).length;
      if (unmapped) warnings.push({ key: "unrecognizedColumnsWarning", count: unmapped });
      if (reportType === "payments" && usedFields.includes("amount")) warnings.push({ key: "amountSignWarning" });
      const item = {
        id: crypto.randomUUID(),
        fileName: file.name,
        reportType,
        importedAt: new Date().toISOString(),
        rows: mapped,
        warnings,
        isDemo: false,
        sourceHeaders: parsed.headers,
      };
      await save([...imports, item]);
      setSuccess(t("importDone"));
      setParsed(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      notify(t("importDone"));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("importer")} description={t("importerSub")} />
      <ErrorMessage>{error}</ErrorMessage><SuccessMessage>{success}</SuccessMessage>
      <Card className="section-card">
        <form onSubmit={analyze}>
          <div className="section-body">
            <div className="upload-controls">
              <label className="field">{t("reportTypeChoose")}
                <select value={reportType} required onChange={(event) => changeReportType(event.target.value)}>
                  {reportTypes.map((type) => <option key={type} value={type}>{translateReport(t, type)}</option>)}
                </select>
              </label>
              <div className="field"><span>{t("fileLabel")}</span>
                <div className="upload-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault();
                  const dropped = event.dataTransfer.files?.[0];
                  if (dropped) { setFile(dropped); setParsed(null); setError(""); setSuccess(""); }
                }}>
                  <FileSpreadsheet size={22} />
                  <strong>{file ? file.name : t("dropFile")}</strong>
                  <p>{file ? `${(file.size / 1024).toFixed(1)} KB` : t("fileRestrictions")}</p>
                  <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" required onChange={(event) => { setFile(event.target.files?.[0] ?? null); setParsed(null); setError(""); setSuccess(""); }} aria-label={t("fileLabel")} />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <FileUp size={15} />}{t("analyze")}</Button>
          </div>
        </form>
      </Card>

      {parsed && inspection && (
        <>
          <Card className="section-card" style={{ marginTop: 16 }}>
            <div className="section-heading"><h2>{t("mapping")}</h2><Badge tone="blue">{parsed.headers.length} columns</Badge></div>
            <div className="section-body">
              <p className="muted" style={{ fontSize: 11, marginTop: 0 }}>{t("mappingHelp")}</p>
              <div className="data-table-wrap"><table className="data-table mapping-table">
                <thead><tr><th>{t("originalColumn")}</th><th>{t("detectedField")}</th><th>{t("dataType")}</th><th>{t("confidence")}</th></tr></thead>
                <tbody>{parsed.headers.map((header) => {
                  const current = mappings[header] || "";
                  return <tr key={header}><td className="table-primary">{header}</td><td>
                    <select className="select" value={current} onChange={(event) => setMappings((old) => ({ ...old, [header]: event.target.value }))}>
                      <option value="">{t("ignore")}</option>
                      {Object.keys(fields).map((field) => <option key={field} value={field} disabled={usedFields.includes(field) && current !== field}>{translateField(t, field)}</option>)}
                    </select>
                  </td><td>{t(`dataTypes.${columnTypes[header]}`)}</td><td><Badge tone={current ? "success" : "warning"}>{current ? t("highConfidence") : t("lowConfidence")}</Badge></td></tr>;
                })}</tbody>
              </table></div>
            </div>
          </Card>
          <Card className="section-card" style={{ marginTop: 16 }}>
            <div className="section-heading"><h2>{t("preview")}</h2><span className="muted" style={{ fontSize: 11 }}>{file?.name}</span></div>
            <div className="summary-row">
              <span>{t("rows")}: <strong>{inspection.rowCount}</strong></span>
              <span>{t("validRows")}: <strong>{inspection.validCount}</strong></span>
              <span>{t("invalidRows")}: <strong>{inspection.invalidIndexes.length}</strong></span>
              <span>{t("duplicateRows")}: <strong>{inspection.duplicateIndexes.length}</strong></span>
              <span>{t("missingValues")}: <strong>{inspection.missingValues}</strong></span>
              <span>{t("emptyColumns")}: <strong>{inspection.emptyColumns.length}</strong></span>
            </div>
            {(inspection.invalidIndexes.length > 0 || inspection.duplicateIndexes.length > 0) && (
              <div className="info-box" style={{ margin: 14 }}>Problematic rows are not removed. They remain in the imported record set with warnings so you can inspect them later.</div>
            )}
            <div className="toolbar">
              <label className="field">{t("inspectRows")}<select value={problemRowsOnly ? "problems" : "all"} onChange={(event) => { setProblemRowsOnly(event.target.value === "problems"); setPreviewPage(0); }}>
                <option value="all">{t("all")}</option><option value="problems">{t("problematicRows")}</option>
              </select></label>
              <span className="muted">{previewIndexes.length ? `${previewPage * pageSize + 1}–${Math.min((previewPage + 1) * pageSize, previewIndexes.length)} / ${previewIndexes.length}` : `0 / 0`}</span>
              <Button variant="secondary" disabled={previewPage === 0} onClick={() => setPreviewPage((page) => page - 1)}>{t("previous")}</Button>
              <Button variant="secondary" disabled={(previewPage + 1) * pageSize >= previewIndexes.length} onClick={() => setPreviewPage((page) => page + 1)}>{t("next")}</Button>
            </div>
            <div className="data-table-wrap"><table className="data-table">
              <thead><tr><th>{t("row")}</th><th>{t("status")}</th>{parsed.headers.slice(0, 6).map((header) => <th key={header}>{mappings[header] ? translateField(t, mappings[header]) : header}</th>)}</tr></thead>
              <tbody>{previewRows.map((index) => <tr key={index}><td>{index + 1}</td><td>{inspection.invalidIndexes.includes(index) ? <Badge tone="danger">{t("invalidRow")}</Badge> : inspection.duplicateIndexes.includes(index) ? <Badge tone="warning">{t("duplicateRow")}</Badge> : <Badge tone="success">{t("validRow")}</Badge>}</td>{parsed.headers.slice(0, 6).map((header) => <td key={header}>{String(parsed.rows[index][header] ?? "—").slice(0, 90)}</td>)}</tr>)}</tbody>
            </table></div>
            <div className="section-body"><Button onClick={confirmImport} disabled={busy}><CheckCircle2 size={15} />{busy ? t("loading") : t("confirmImport")}</Button></div>
          </Card>
        </>
      )}
    </>
  );
}
