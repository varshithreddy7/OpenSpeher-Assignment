import type { PageBreakAnchor } from "@/app/utils/pageCalculations";

export type PageBreakIndicatorProps = {
  /** Breaks returned by `computePageBreaks`. */
  breaks: PageBreakAnchor[];
  /** Content-area page height (px). */
  pageHeightPx: number;
  /** Width of the content area (px) so the indicator matches the page background. */
  pageWidthPx: number;
};

export function PageBreakIndicator(props: PageBreakIndicatorProps) {
  const { breaks, pageHeightPx, pageWidthPx } = props;

  // We only need the Y location. The anchor itself (element/text-offset) is useful
  // if later you want to map back into ProseMirror positions.
  return (
    <div className="page-break-indicator pointer-events-none absolute inset-0" aria-hidden="true">
      {breaks.map((b, idx) => {
        const pageNumber = Math.round(b.pageStartY / pageHeightPx) + 1;

        return (
          <div
            key={`${b.pageStartY}-${idx}`}
            className="absolute left-0"
            style={{
              top: `${b.pageStartY}px`,
              width: `${pageWidthPx}px`,
            }}
          >
            <div className="relative">
              <div className="h-px w-full bg-gray-300/80" />
              <div className="absolute -top-3 right-0 rounded bg-white px-1 text-[10px] text-gray-500 shadow-sm">
                Page {pageNumber}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

