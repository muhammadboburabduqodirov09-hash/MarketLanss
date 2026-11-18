"use client";

import { motion } from "motion/react";
import { easeOut } from "@/components/motion";

// Remounts on every route change: a short fade so content does not snap in. No lift — the nav pill already shows where you went.
export default function Template({ children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: easeOut }}>
      {children}
    </motion.div>
  );
}
