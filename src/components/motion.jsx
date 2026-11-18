"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatMoney } from "@/components/ui";

export const easeOut = [0.23, 1, 0.32, 1];

// One page-load sequence: the parent staggers, each child fades up once.
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } } };

const formatters = {
  money: (value, language) => formatMoney(value, language),
  percent: (value) => `${value.toFixed(1)}%`,
  integer: (value) => Math.round(value).toLocaleString(),
};

// Counts from the previously shown number to `value`. Server and reduced-motion output is the final number.
export function CountUp({ value, from = 0, kind = "integer", language }) {
  const ref = useRef(null);
  const shown = useRef(from);
  const reduce = useReducedMotion();

  // Layout effect + an immediate write, so the final number never flashes before the count starts.
  useLayoutEffect(() => {
    const format = formatters[kind];
    if (reduce) { shown.current = value; return undefined; }
    if (ref.current) ref.current.textContent = format(shown.current, language);
    const controls = animate(shown.current, value, {
      duration: 0.7,
      ease: easeOut,
      onUpdate: (latest) => {
        shown.current = latest;
        if (ref.current) ref.current.textContent = format(latest, language);
      },
    });
    return () => controls.stop();
  }, [value, kind, language, reduce]);

  return <span ref={ref}>{formatters[kind](value, language)}</span>;
}
