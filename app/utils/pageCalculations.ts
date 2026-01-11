export type PageBreakAnchor =
  | {
      /** Break starts at the next page; split happens before this element. */
      kind: "before-element";
      element: Element;
      /** Root-local Y coordinate (px) at which the new page starts. */
      pageStartY: number;
    }
  | {
      /** Break starts at the next page; split happens inside a text node. */
      kind: "text-offset";
      textNode: Text;
      /** Character offset within `textNode.data` where the split should occur. */
      offset: number;
      /** Root-local Y coordinate (px) at which the new page starts. */
      pageStartY: number;
    };

export type PaginationResult = {
  /** The content-area height for a page (px). For US Letter with 1" margins at 96DPI, this is 864. */
  pageHeightPx: number;
  /** Top margin shown on-screen per page (px). Use 96 for 1 inch at 96DPI. */
  topMarginPx: number;
  /** Bottom margin shown on-screen per page (px). Use 96 for 1 inch at 96DPI. */
  bottomMarginPx: number;
  /** Gap between page "papers" on screen (px). Hidden in print. */
  pageGapPx: number;
  /** The on-screen vertical stride from one page top to the next (paper height + gap). */
  pageStridePx: number;
  /** Page breakpoints (start of page 2, page 3, ...) in document order. */
  breaks: PageBreakAnchor[];
  /** Measured rendered height of the root content (px). */
  contentHeightPx: number;
};

export type PaginateOptions = {
  pageHeightPx: number;
  /** Optional top margin before content, repeated per page (px). Default: 0. */
  topMarginPx?: number;
  /** Optional bottom margin after content, repeated per page (px). Default: 0. */
  bottomMarginPx?: number;
  /** Optional gap between pages on screen (px). Default: 0. */
  pageGapPx?: number;
  /**
   * Selector for block-level elements we consider as pagination units.
   * Keep this narrow for performance.
   */
  blockSelector?: string;
  /**
   * Safety valve for binary search splitting inside a text node.
   * 18 steps covers up to ~260k chars (2^18) which is plenty per block.
   */
  maxBinarySearchSteps?: number;
};

const DEFAULT_BLOCK_SELECTOR = "p,h1,h2,h3,li,blockquote,pre";

function getRootLocalY(root: HTMLElement, viewportY: number): number {
  // `getBoundingClientRect()` returns viewport coordinates.
  // Convert to coordinates relative to the root's scroll space.
  const rootRect = root.getBoundingClientRect();
  return viewportY - rootRect.top + root.scrollTop;
}

function getElementTopBottomY(root: HTMLElement, el: Element): { top: number; bottom: number } {
  const r = el.getBoundingClientRect();
  return { top: getRootLocalY(root, r.top), bottom: getRootLocalY(root, r.bottom) };
}

function isVisibleElement(el: Element): boolean {
  // Skip empty blocks that contribute no height.
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function* walkTextNodes(root: Node): Generator<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      // Whitespace-only nodes can create unstable rect measurements.
      if (!node.data || node.data.trim().length === 0) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let n: Node | null = walker.nextNode();
  while (n) {
    yield n as Text;
    n = walker.nextNode();
  }
}

function caretPositionFromPoint(viewportX: number, viewportY: number):
  | { node: Node; offset: number }
  | null {
  // Chrome / Chromium
  const doc = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(viewportX, viewportY);
    if (!r) return null;
    return { node: r.startContainer, offset: r.startOffset };
  }

  // Firefox
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(viewportX, viewportY);
    if (!pos) return null;
    return { node: pos.offsetNode, offset: pos.offset };
  }

  return null;
}

function getFirstTextDescendant(node: Node): Text | null {
  for (const t of walkTextNodes(node)) return t;
  return null;
}

function getLastTextDescendant(node: Node): Text | null {
  let last: Text | null = null;
  for (const t of walkTextNodes(node)) last = t;
  return last;
}

function normalizeCaretToTextPosition(block: Element, caret: { node: Node; offset: number }):
  | { textNode: Text; offset: number }
  | null {
  // Ensure the caret is within the block we are splitting.
  if (!block.contains(caret.node)) return null;

  if (caret.node instanceof Text) {
    return {
      textNode: caret.node,
      offset: Math.max(0, Math.min(caret.offset, caret.node.data.length)),
    };
  }

  // If caret landed on an element boundary, try to find a nearby text node.
  if (caret.node instanceof Element) {
    const el = caret.node;
    const childCount = el.childNodes.length;
    const i = Math.max(0, Math.min(caret.offset, Math.max(0, childCount - 1)));
    const child = el.childNodes[i] ?? null;

    // Prefer first text inside the child; otherwise last text in previous siblings.
    if (child) {
      const first = getFirstTextDescendant(child);
      if (first) return { textNode: first, offset: 0 };
    }

    for (let j = i - 1; j >= 0; j--) {
      const prev = el.childNodes[j];
      const last = getLastTextDescendant(prev);
      if (last) return { textNode: last, offset: last.data.length };
    }
  }

  return null;
}

function measureBlockToTextOffsetBottomY(
  root: HTMLElement,
  block: Element,
  textNode: Text,
  offset: number,
): number {
  // Measure the rendered bottom Y of the block content from the *start of the block*
  // up to (textNode, offset). This correctly accounts for multiple text nodes,
  // marks, inline nodes, wrapping, etc.
  const r = document.createRange();
  r.selectNodeContents(block);
  r.setEnd(textNode, Math.max(0, Math.min(offset, textNode.data.length)));

  const rects = r.getClientRects();
  if (rects.length === 0) return Number.NEGATIVE_INFINITY;
  const last = rects[rects.length - 1];
  return getRootLocalY(root, last.bottom);
}

function binarySearchSplitOffset(opts: {
  root: HTMLElement;
  block: Element;
  textNode: Text;
  boundaryY: number;
  maxSteps: number;
}): number {
  const { root, block, textNode, boundaryY, maxSteps } = opts;

  // If even the first character overflows, return 0 (caller should break before block).
  const firstCharBottom = measureBlockToTextOffsetBottomY(root, block, textNode, 1);
  if (firstCharBottom > boundaryY) return 0;

  let lo = 0;
  let hi = textNode.data.length;
  let best = 0;
  let steps = 0;

  while (lo <= hi && steps < maxSteps) {
    steps++;
    const mid = (lo + hi) >> 1;
    const bottom = measureBlockToTextOffsetBottomY(root, block, textNode, mid);

    if (bottom <= boundaryY) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Prefer a whitespace boundary so the split doesn't happen mid-word.
  const data = textNode.data;
  const maxBacktrack = 40;
  let refined = best;
  let back = 0;
  while (refined > 0 && back < maxBacktrack) {
    if (/\s/.test(data.charAt(refined - 1))) break;
    refined--;
    back++;
  }
  if (refined <= 0) refined = best;

  return refined;
}

function findSplitPointWithinBlock(opts: {
  root: HTMLElement;
  block: Element;
  boundaryY: number;
  maxBinarySearchSteps: number;
}): { textNode: Text; offset: number } | null {
  const { root, block, boundaryY, maxBinarySearchSteps } = opts;

  // Fast path: use caret APIs to get a DOM position at the boundary without scanning.
  // This tends to be much faster for complex blocks (multiple inline nodes).
  const rootRect = root.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const viewportY = rootRect.top - root.scrollTop + boundaryY - 1;
  const viewportX = Math.max(blockRect.left + 2, Math.min(blockRect.right - 2, rootRect.right - 2));

  const caret = caretPositionFromPoint(viewportX, viewportY);
  if (caret) {
    const normalized = normalizeCaretToTextPosition(block, caret);
    if (normalized) {
      const bottom = measureBlockToTextOffsetBottomY(root, block, normalized.textNode, normalized.offset);
      // Make sure the proposed split actually fits above the boundary.
      if (bottom <= boundaryY && normalized.offset > 0) {
        return normalized;
      }
    }
  }

  // Robust fallback: traverse text nodes in order and find the last position that fits.
  // This is more expensive but only runs when a block crosses a boundary.
  let previousTextNode: Text | null = null;

  for (const textNode of walkTextNodes(block)) {
    const endBottom = measureBlockToTextOffsetBottomY(root, block, textNode, textNode.data.length);
    if (endBottom <= boundaryY) {
      previousTextNode = textNode;
      continue;
    }

    // The split occurs inside this node.
    const offset = binarySearchSplitOffset({
      root,
      block,
      textNode,
      boundaryY,
      maxSteps: maxBinarySearchSteps,
    });

    if (offset <= 0) {
      // Nothing in this node fits; if we have prior text, split at its end.
      if (previousTextNode) {
        return { textNode: previousTextNode, offset: previousTextNode.data.length };
      }
      return null;
    }

    return { textNode, offset };
  }

  return null;
}

export function computePageBreaks(root: HTMLElement, options: PaginateOptions): PaginationResult {
  const pageHeightPx = options.pageHeightPx;
  const topMarginPx = options.topMarginPx ?? 0;
  const bottomMarginPx = options.bottomMarginPx ?? 0;
  const pageGapPx = options.pageGapPx ?? 0;
  const pageStridePx = pageHeightPx + topMarginPx + bottomMarginPx + pageGapPx;

  const blockSelector = options.blockSelector ?? DEFAULT_BLOCK_SELECTOR;
  const maxBinarySearchSteps = options.maxBinarySearchSteps ?? 18;

  // The total rendered content height; used to derive the number of pages.
  // Note: scrollHeight includes overflow content even if root itself doesn't scroll.
  const contentHeightPx = root.scrollHeight;

  const blocks = Array.from(root.querySelectorAll(blockSelector)).filter(isVisibleElement);

  const breaks: PageBreakAnchor[] = [];
  // Content starts after the top margin spacer.
  // We paginate within the content-area height; the visible margins and inter-page
  // gap are added via decoration widgets.
  let currentPageBottom = topMarginPx + pageHeightPx;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const { top, bottom } = getElementTopBottomY(root, block);

    // Fits completely on this page.
    if (bottom <= currentPageBottom) continue;

    // If the block starts after the boundary, we can break before it and advance pages.
    while (top >= currentPageBottom) {
      breaks.push({
        kind: "before-element",
        element: block,
        pageStartY: currentPageBottom,
      });
      currentPageBottom += pageStridePx;
    }

    // Now: top < currentPageBottom < bottom => block crosses boundary.
    const split = findSplitPointWithinBlock({
      root,
      block,
      boundaryY: currentPageBottom,
      maxBinarySearchSteps,
    });

    if (split) {
      breaks.push({
        kind: "text-offset",
        textNode: split.textNode,
        offset: split.offset,
        pageStartY: currentPageBottom,
      });
      currentPageBottom += pageStridePx;
      continue;
    }

    // If we cannot split this block (e.g., no text nodes), move it to the next page.
    breaks.push({
      kind: "before-element",
      element: block,
      pageStartY: currentPageBottom,
    });
    currentPageBottom += pageStridePx;
  }

  return {
    pageHeightPx,
    topMarginPx,
    bottomMarginPx,
    pageGapPx,
    pageStridePx,
    breaks,
    contentHeightPx,
  };
}

