# Marketplace Intelligence

A JavaScript, Next.js App Router, and Tailwind CSS local-first MVP for importing marketplace CSV/XLS/XLSX reports, auditing settlements, and investigating returns. Data processing is deterministic; the app does not connect to marketplace APIs. Excel parsing uses a maintained SheetJS-compatible release because the npm `xlsx` package version is affected by published security advisories.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. To create a production build, run `npm run build`, then `npm start`.

## Local data and environment

The default local demo mode stores imports and the selected interface language in `data/store.json` through the server-side `/api/store` route. The directory and file are created on the first save. Keep the development server on a trusted machine; this local mode has no login or multi-user data isolation.

No environment variables are required. Optionally copy `.env.example` to `.env.local` and set `LOCAL_STORE_PATH` to a different project-relative JSON file path. There is no PostgreSQL database or Supabase authentication configured in this MVP; no credentials or marketplace API keys are needed.

## Demo and sample files

On Overview, choose **Load demo data**. Fictional reports are generated and sent through the same column recognition, row mapping, validation, and calculation functions used by uploaded data. The demo has 120 orders, payment transactions, 24 return records, feedback, and six products. Its payment report intentionally contains two changed amounts and a duplicate payment.

The generated CSV samples are in `public/samples/` and are downloadable from Help. Regenerate them with:

```powershell
npm run samples
```

## Import workflow

Choose a report type, then select or drop a CSV, XLSX, or XLS file (up to 10 MB / 100,000 rows). Confirm the proposed column mappings; ambiguous amount columns are not mapped automatically. Review the preview and warnings, then import. Rows with missing values and duplicates are retained, not silently discarded. Original row values and unmapped fields are retained with each standardized row.

Payments are matched by order ID. Expected values use order totals (or quantity × unit price) plus signed, explicitly categorized settlement adjustments; see the auditor for the calculation explanation. Return reason categories are keyword suggestions and editable. Return rate is only available when order data is imported.

Use the language selector to choose English, Russian, or Uzbek for application labels and analysis. Imported source values are not translated or modified.

## Checks

```powershell
npm test
npm run lint
npm run build
```

## Limitations

- Local JSON storage is for a single-user development/demo deployment, not a production multi-user database. Add authenticated ownership and PostgreSQL before exposing it to users.
- Login/register routes explain that authentication is not configured; they do not collect credentials.
- Currency is not detected or converted. Amounts remain in the source report's units.
- Matching and return categories are deterministic and depend on the imported fields and marketplace report semantics.
- The project intentionally has no live marketplace integrations or AI analysis.
