import type { ReactNode } from "react";

import { PageBreakIndicator } from "@/app/components/PageBreakIndicator";
import type { PaginationResult } from "@/app/utils/pageCalculations";

export const PAGE_PAPER_WIDTH_PX = 816;
export const PAGE_PAPER_HEIGHT_PX = 1056;
export const PAGE_MARGIN_PX = 96;
export const PAGE_GAP_PX = 24;

export const PAGE_CONTENT_WIDTH_PX = 624;
export const PAGE_CONTENT_HEIGHT_PX = 864;

export type PageContainerProps = {
  children: ReactNode;
  pagination: PaginationResult | null;
};

export function PageContainer(props: PageContainerProps) {
  const { children, pagination } = props;

  const pageStridePx = pagination?.pageStridePx ?? (PAGE_PAPER_HEIGHT_PX + PAGE_GAP_PX);

  const pageCount = pagination ? Math.max(1, pagination.breaks.length + 1) : 1;
  const overlayHeightPx = Math.max(PAGE_PAPER_HEIGHT_PX, pageCount * pageStridePx);

  return (
    <div className="page-shell mx-auto" style={{ width: `${PAGE_PAPER_WIDTH_PX}px` }}>
      <div className="page-viewport relative" style={{ minHeight: `${PAGE_PAPER_HEIGHT_PX}px` }}>
        <div
          className="page-overlay pointer-events-none absolute left-0 top-0"
          style={{ width: `${PAGE_PAPER_WIDTH_PX}px`, height: `${overlayHeightPx}px` }}
          aria-hidden="true"
        >
          {Array.from({ length: pageCount }).map((_, idx) => {
            const top = idx * pageStridePx;
            return (
              <div key={idx} className="absolute left-0" style={{ top: `${top}px` }}>
                <div
                  className="page-paper bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_40px_rgba(0,0,0,0.10)]"
                  style={{ width: `${PAGE_PAPER_WIDTH_PX}px`, height: `${PAGE_PAPER_HEIGHT_PX}px` }}
                />
                <div
                  className="page-number absolute"
                  style={{
                    left: `${PAGE_MARGIN_PX}px`,
                    right: `${PAGE_MARGIN_PX}px`,
                    bottom: `${PAGE_MARGIN_PX / 2}px`,
                  }}
                >
                  <div className="text-[10px] text-gray-400/90 text-right">{idx + 1}</div>
                </div>
              </div>
            );
          })}
        </div>

        {pagination ? (
          <PageBreakIndicator
            breaks={pagination.breaks}
            pageHeightPx={pagination.pageStridePx}
            pageWidthPx={PAGE_PAPER_WIDTH_PX}
          />
        ) : null}

        <div className="page-content-padding relative z-10" style={{ paddingLeft: `${PAGE_MARGIN_PX}px`, paddingRight: `${PAGE_MARGIN_PX}px` }}>
          <div style={{ width: `${PAGE_CONTENT_WIDTH_PX}px` }} className="page-content-column mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

