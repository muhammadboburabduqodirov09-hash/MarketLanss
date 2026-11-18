"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { easeOut } from "@/components/motion";
import {
  AlignJustify,
  Boxes,
  LayoutGrid,
  List,
  Package,
  Search,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, formatMoney } from "@/components/ui";
import { calculateProductCatalog } from "@/lib/data";

const viewOptions = [
  { value: "cards", icon: LayoutGrid },
  { value: "rows", icon: List },
  { value: "compact", icon: AlignJustify },
];

const salesPeriods = ["week", "month", "year"];

function ProductPrice({ product, language }) {
  const hasDiscount = product.discountPercent > 0;
  const currentPrice = hasDiscount
    ? product.unitPrice * (1 - product.discountPercent / 100)
    : product.unitPrice;

  return (
    <span className="product-price">
      {hasDiscount && <del>{formatMoney(product.unitPrice, language)}</del>}
      <strong>{product.unitPrice === null ? "—" : formatMoney(currentPrice, language)}</strong>
    </span>
  );
}

const dialogMotion = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.16 } },
  transition: { duration: 0.26, ease: easeOut },
};
const sheetEase = [0.32, 0.72, 0, 1];
const sheetMotion = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%", transition: { duration: 0.25, ease: sheetEase } },
  transition: { duration: 0.4, ease: sheetEase },
};

export default function ProductsPage() {
  const { imports, stockOverrides, language, t, save, notify } = useApp();
  const [view, setView] = useState("cards");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [period, setPeriod] = useState("week");
  const [stockDraft, setStockDraft] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { savingRef.current = saving; }, [saving]);
  const [error, setError] = useState("");
  const products = useMemo(
    () => calculateProductCatalog(imports, stockOverrides),
    [imports, stockOverrides],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query))
      : products;
  }, [products, search]);
  const selectedProduct = products.find((product) => product.key === selectedKey);
  const dialogOpen = Boolean(selectedProduct);
  // Dialog keyboard contract: focus moves in, Tab stays inside, Escape closes, focus returns to the opener.
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector("button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { if (!savingRef.current) setSelectedKey(""); return; }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = dialog.querySelectorAll("button:not(:disabled), input:not(:disabled)");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [dialogOpen]);
  // Phones show the dialog as a bottom sheet, so it rises from the edge it is attached to. Only read after a click, never on the server.
  const sheet = Boolean(selectedProduct) && window.matchMedia("(max-width: 680px)").matches;

  function openProduct(product) {
    setSelectedKey(product.key);
    setStockDraft(product.stock === null ? "" : String(product.stock));
    setPeriod("week");
    setError("");
  }

  async function saveStock() {
    const stockQuantity = Number(stockDraft);
    if (!selectedProduct || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0) return;
    const nextOverrides = [
      ...stockOverrides.filter((item) => item.key !== selectedProduct.key),
      { key: selectedProduct.key, stockQuantity },
    ];
    setSaving(true);
    setError("");
    try {
      await save(imports, language, nextOverrides);
      notify(t("catalog.stockSaved"));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function productAction(product) {
    return (
      <button
        className="product-open-button"
        onClick={() => openProduct(product)}
        aria-label={`${t("catalog.details")}: ${product.name}`}
      >
        {t("catalog.details")}
      </button>
    );
  }

  function renderCard(product) {
    return (
      <Card className="product-card" key={product.key}>
        <div className="product-card-art"><Package size={23} /></div>
        <div className="product-card-content">
          <div className="product-card-title">
            <div><h2>{product.name}</h2><small>{product.sku || t("catalog.noSku")}</small></div>
            {product.discountPercent > 0 && <Badge tone="success">-{product.discountPercent}%</Badge>}
          </div>
          <ProductPrice product={product} language={language} />
          <div className="product-card-meta">
            <span>{t("catalog.stock")}</span><strong>{product.stock ?? "—"}</strong>
            <span>{t("catalog.unitsSoldYear")}</span><strong>{product.sales.year}</strong>
          </div>
          {product.promotion && <p className="product-promotion"><Tag size={13} />{product.promotion}</p>}
          {productAction(product)}
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title={t("catalog.title")} description={t("catalog.description")} />
      <Card className="product-catalog">
        <div className="product-toolbar">
          <label className="search-field product-search">
            <Search size={15} />
            <span className="sr-only">{t("catalog.search")}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("catalog.search")} />
          </label>
          <span className="product-count">{filteredProducts.length} {t("catalog.productCount")}</span>
          <div className="product-view-switch" role="group" aria-label={t("catalog.displayMode")}>
            {viewOptions.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={view === value ? "product-view-active" : ""}
                onClick={() => setView(value)}
                aria-label={t(`catalog.view.${value}`)}
                aria-pressed={view === value}
              ><Icon size={16} /></button>
            ))}
          </div>
        </div>

        {filteredProducts.length ? view === "cards" ? (
          <div className="product-grid">{filteredProducts.map(renderCard)}</div>
        ) : view === "rows" ? (
          <div className="data-table-wrap">
            <table className="data-table product-table">
              <thead><tr>
                <th>{t("product")}</th><th>{t("catalog.price")}</th><th>{t("catalog.stock")}</th>
                <th>{t("catalog.unitsSoldYear")}</th><th>{t("catalog.promotion")}</th><th>{t("actions")}</th>
              </tr></thead>
              <tbody>{filteredProducts.map((product) => (
                <tr key={product.key}>
                  <td className="product-table-name"><strong>{product.name}</strong><small>{product.sku || t("catalog.noSku")}</small></td>
                  <td><ProductPrice product={product} language={language} /></td>
                  <td>{product.stock ?? "—"}</td>
                  <td>{product.sales.year}</td>
                  <td>{product.promotion || (product.discountPercent > 0 ? `-${product.discountPercent}%` : "—")}</td>
                  <td>{productAction(product)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="product-compact-list">{filteredProducts.map((product) => (
            <div className="product-compact-row" key={product.key}>
              <div><strong>{product.name}</strong><small>{product.sku || t("catalog.noSku")}</small></div>
              <ProductPrice product={product} language={language} />
              <span>{t("catalog.stock")}: <strong>{product.stock ?? "—"}</strong></span>
              <span>{t("catalog.unitsSoldYear")}: <strong>{product.sales.year}</strong></span>
              {productAction(product)}
            </div>
          ))}</div>
        ) : (
          <EmptyState
            title={search ? t("catalog.noMatches") : t("catalog.emptyTitle")}
            description={search ? t("catalog.noMatchesDescription") : t("catalog.emptyDescription")}
            action={!search && <a className="text-link" href="/import">{t("importData")} →</a>}
          />
        )}
      </Card>

      <AnimatePresence>
      {selectedProduct && (
        <motion.div className="product-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedKey("");
        }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.2 }}>
          <motion.section
            ref={dialogRef}
            className="product-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            {...(sheet ? sheetMotion : dialogMotion)}
          >
            <div className="product-detail-heading">
              <div><span className="product-detail-icon"><Boxes size={19} /></span>
                <div><h2 id="product-detail-title">{selectedProduct.name}</h2><small>{selectedProduct.sku || t("catalog.noSku")}</small></div>
              </div>
              <button className="icon-button" onClick={() => setSelectedKey("")} aria-label={t("close")}><X size={17} /></button>
            </div>
            <div className="product-detail-body">
              <div className="product-detail-stats">
                <div><span>{t("catalog.price")}</span><ProductPrice product={selectedProduct} language={language} /></div>
                <div><span>{t("catalog.stock")}</span><strong>{selectedProduct.stock ?? "—"}</strong></div>
                <div><span>{t("catalog.popularity")}</span><strong><TrendingUp size={14} />{selectedProduct.sales.year}</strong></div>
              </div>
              <section className="product-detail-section">
                <div className="product-detail-section-heading"><h3>{t("catalog.sales")}</h3>
                  <div className="product-period-switch" role="group" aria-label={t("catalog.salesPeriod")}>
                    {salesPeriods.map((value) => <button
                      type="button"
                      key={value}
                      className={period === value ? "product-period-active" : ""}
                      onClick={() => setPeriod(value)}
                      aria-pressed={period === value}
                    >{t(`catalog.period.${value}`)}</button>)}
                  </div>
                </div>
                <div className="product-sales-total"><strong>{selectedProduct.sales[period]}</strong><span>{t("catalog.unitsSold")}</span></div>
              </section>
              <section className="product-detail-section">
                <h3>{t("catalog.descriptionLabel")}</h3>
                <p className="product-description">{selectedProduct.description || t("catalog.noDescription")}</p>
              </section>
              <section className="product-detail-section">
                <h3>{t("catalog.promotion")}</h3>
                {selectedProduct.promotion || selectedProduct.discountPercent > 0 ? (
                  <div className="product-promotion-detail"><Tag size={15} />
                    <span>{selectedProduct.promotion || t("catalog.discount")}</span>
                    {selectedProduct.discountPercent > 0 && <Badge tone="success">-{selectedProduct.discountPercent}%</Badge>}
                  </div>
                ) : <p className="muted">{t("catalog.noPromotion")}</p>}
              </section>
              <form className="product-stock-form" onSubmit={(event) => { event.preventDefault(); saveStock(); }}>
                <label className="field">{t("catalog.editStock")}
                  <input type="number" min="0" max="100000000" step="1" required value={stockDraft} onChange={(event) => setStockDraft(event.target.value)} />
                </label>
                <Button type="submit" disabled={saving || stockDraft === "" || !Number.isSafeInteger(Number(stockDraft)) || Number(stockDraft) < 0}>
                  {saving ? t("catalog.saving") : t("catalog.saveStock")}
                </Button>
              </form>
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          </motion.section>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
