import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PaginationResult } from "@/app/utils/pageCalculations";
import { computePageBreaks } from "@/app/utils/pageCalculations";

type EditorEventEmitter = {
  on?: (event: unknown, callback: (...args: unknown[]) => void) => unknown;
  off?: (event: unknown, callback: (...args: unknown[]) => void) => unknown;
};

function asEventEmitter(editor: unknown): EditorEventEmitter | null {
  if (!editor || typeof editor !== "object") return null;
  return editor as EditorEventEmitter;
}

export type UsePaginationOptions = {
  /** Content-area page height (px). US Letter with 1" margins at 96DPI is 864px. */
  pageHeightPx: number;
  /** Top margin shown per page (px). Use 96 for 1 inch at 96DPI. */
  topMarginPx?: number;
  /** Bottom margin shown per page (px). Use 96 for 1 inch at 96DPI. */
  bottomMarginPx?: number;
  /** Visual gap between page papers on screen (px). */
  pageGapPx?: number;
  /** Debounce delay for recomputation while typing. */
  debounceMs?: number;
};

export function usePagination(
  root: HTMLElement | null,
  editor: unknown,
  options: UsePaginationOptions,
): PaginationResult | null {
  const {
    pageHeightPx,
    topMarginPx = 0,
    bottomMarginPx = 0,
    pageGapPx = 0,
    debounceMs = 50,
  } = options;

  const [result, setResult] = useState<PaginationResult | null>(null);

  // Keep stable refs for debouncing and cleanup.
  const destroyedRef = useRef(false);
  const timeoutIdRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const recomputeNow = useCallback(() => {
    if (!root) return;
    if (destroyedRef.current) return;

    // Run in the next animation frame to avoid measuring mid-layout.
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (destroyedRef.current) return;
      setResult(
        computePageBreaks(root, {
          pageHeightPx,
          topMarginPx,
          bottomMarginPx,
          pageGapPx,
        }),
      );
    });
  }, [root, pageHeightPx, topMarginPx, bottomMarginPx, pageGapPx]);

  const scheduleRecompute = useCallback(() => {
    if (!root) return;
    if (destroyedRef.current) return;

    if (timeoutIdRef.current !== null) window.clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = window.setTimeout(() => {
      timeoutIdRef.current = null;
      recomputeNow();
    }, debounceMs);
  }, [root, debounceMs, recomputeNow]);

  const editorUpdateHandler = useMemo(() => {
    // Avoid re-subscribing with a new function on every render.
    return () => scheduleRecompute();
  }, [scheduleRecompute]);

  useEffect(() => {
    destroyedRef.current = false;

    // If there is no root yet, do nothing.
    if (!root) return;

    const ee = asEventEmitter(editor);

    // Observe size changes of the editor root. This captures window resize and
    // any layout changes affecting line wrapping.
    const ro = new ResizeObserver(() => scheduleRecompute());
    ro.observe(root);

    // Subscribe to Tiptap update events so edits trigger pagination.
    // (This is usually cheaper and more reliable than a MutationObserver.)
    if (ee?.on) ee.on("update", editorUpdateHandler);

    // Initial measurement.
    scheduleRecompute();

    return () => {
      destroyedRef.current = true;
      ro.disconnect();

      if (ee?.off) ee.off("update", editorUpdateHandler);

      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [root, editor, scheduleRecompute, editorUpdateHandler]);

  return result;
}

