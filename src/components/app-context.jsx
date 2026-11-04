"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate } from "@/lib/translations";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [imports, setImports] = useState([]);
  const [language, setLanguageState] = useState("en");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/store")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load saved local data.");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setImports(Array.isArray(data.imports) ? data.imports : []);
        setLanguageState(["en", "ru", "uz"].includes(data.language) ? data.language : "en");
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  const save = useCallback(async (nextImports, nextLanguage = language) => {
    const response = await fetch("/api/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imports: nextImports, language: nextLanguage }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save your data.");
    setImports(nextImports);
    setLanguageState(nextLanguage);
    setError("");
  }, [language]);

  const setLanguage = useCallback(async (nextLanguage) => {
    try {
      await save(imports, nextLanguage);
    } catch (saveError) {
      setToast(saveError.message);
      window.setTimeout(() => setToast(""), 3500);
    }
  }, [imports, save]);

  const value = useMemo(() => ({
    imports, language, ready, error, toast,
    t: (key) => translate(language, key),
    save,
    setLanguage,
    clearToast: () => setToast(""),
    notify: (message) => {
      setToast(message);
      window.setTimeout(() => setToast(""), 3500);
    },
  }), [imports, language, ready, error, toast, save, setLanguage]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider.");
  return context;
}
