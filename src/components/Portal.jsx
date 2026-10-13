"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal component that renders children directly into document.body.
 * Ensures modals and overlays escape all parent overflow, transform,
 * and layout containment contexts to cover the entire viewport full screen.
 */
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
