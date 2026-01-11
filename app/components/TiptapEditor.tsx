"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { PageContainer, PAGE_CONTENT_HEIGHT_PX, PAGE_PAPER_WIDTH_PX, PAGE_GAP_PX, PAGE_MARGIN_PX } from "@/app/components/PageContainer";
import { Toolbar } from "@/app/components/Toolbar";
import { usePagination } from "@/app/hooks/usePagination";
import type { PageBreakAnchor } from "@/app/utils/pageCalculations";
import { Pagination } from "@/app/extensions/Pagination";

export function TiptapEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Pagination,
      Placeholder.configure({
        placeholder: "Start typing your legal document...",
      }),
    ],
    content: `
      <h1>Legal Document</h1>
      <p>Start drafting here...</p>
    `,
    immediatelyRender: false,
  });

  // The actual measurement root is the ProseMirror content element.
  // TipTap exposes it as `editor.view.dom`.
  const rootEl = editor?.view?.dom as HTMLElement | null;

  const pagination = usePagination(rootEl, editor, {
    pageHeightPx: PAGE_CONTENT_HEIGHT_PX,
    topMarginPx: PAGE_MARGIN_PX,
    bottomMarginPx: PAGE_MARGIN_PX,
    pageGapPx: PAGE_GAP_PX,
    debounceMs: 50,
  });

  const lastBreakPositionsRef = useRef<string>("__init__");

  const anchorsToDocPositions = useMemo(() => {
    return (anchors: PageBreakAnchor[]): number[] => {
      if (!editor?.view) return [];

      const positions: number[] = [];

      for (const a of anchors) {
        try {
          const pos =
            a.kind === "text-offset"
              ? editor.view.posAtDOM(a.textNode, a.offset)
              : editor.view.posAtDOM(a.element, 0);
          positions.push(pos);
        } catch {
          // Ignore anchors that cannot be mapped.
        }
      }

      // Sort + dedupe to keep decoration updates stable.
      positions.sort((x, y) => x - y);
      return positions.filter((p, i) => i === 0 || p !== positions[i - 1]);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    // Always keep the top spacer active so the first page has a true top margin.
    // Between pages we need: bottom margin + gap + next page top margin.
    const betweenSpacerPx = PAGE_MARGIN_PX + PAGE_GAP_PX + PAGE_MARGIN_PX;

    const anchors = pagination?.breaks ?? [];
    const positions = anchorsToDocPositions(anchors);
    const key = positions.join(",");

    if (key === lastBreakPositionsRef.current) return;
    lastBreakPositionsRef.current = key;

    editor.commands.setPaginationBreaks(positions, PAGE_MARGIN_PX, betweenSpacerPx, PAGE_MARGIN_PX);
  }, [editor, pagination, anchorsToDocPositions]);

  const editorClassName = useMemo(() => {
    // Keep the editor's width pinned to the page content width.
    // The padding here is the "inside the 1-inch margins" content area already.
    return [
      "prose",
      "max-w-none",
      "focus:outline-none",
      "min-h-[400px]",
    ].join(" ");
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto w-full">
        <Toolbar editor={editor} />
        <div className="overflow-x-auto pb-6">
          <div className="mx-auto" style={{ width: `${PAGE_PAPER_WIDTH_PX}px` }}>
            <PageContainer pagination={pagination}>
              <div className="editor-shell relative">
                <EditorContent editor={editor} className={editorClassName} />
              </div>
            </PageContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

