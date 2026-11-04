"use client";

import Link from "next/link";
import { Download, FileUp } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Card, PageHeader } from "@/components/ui";

const helpKeys = [
  ["helpDownloadTitle", "helpDownload"],
  ["helpFileTitle", "helpFile"],
  ["helpMapTitle", "helpMap"],
  ["helpAuditTitle", "helpAudit"],
  ["helpReturnsTitle", "helpReturns"],
  ["helpDataTitle", "helpData"],
];

export default function HelpPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t("helpTitle")} description={t("helpSub")} actions={<Link href="/import" className="button button-primary"><FileUp size={15} />{t("importFirst")}</Link>} />
      <div className="help-grid">
        {helpKeys.map(([title, body]) => <Card className="help-card" key={title}><h2>{t(title)}</h2><p>{t(body)}</p></Card>)}
      </div>
      <Card className="section-card" style={{ marginTop: 16 }}>
        <div className="section-heading"><h2>{t("sampleFiles")}</h2></div>
        <div className="section-body">
          <p className="muted" style={{ fontSize: 12 }}>{t("sampleFilesHelp")}</p>
          <div className="page-actions sample-links">
            {["products_sample.csv", "orders_sample.csv", "payments_sample.csv", "returns_sample.csv", "feedback_sample.csv"].map((file) => <a className="button button-secondary" href={`/samples/${file}`} download key={file}><Download size={14} />{file}</a>)}
          </div>
        </div>
      </Card>
    </>
  );
}
