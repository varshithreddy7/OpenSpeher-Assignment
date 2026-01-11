import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type PaginationMeta = {
  breakPositions: number[];
  topSpacerPx: number;
  betweenSpacerPx: number;
  bottomSpacerPx: number;
};

const paginationPluginKey = new PluginKey<{ decorations: DecorationSet }>(
  "pagination",
);

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagination: {
      setPaginationBreaks: (
        breakPositions: number[],
        topSpacerPx: number,
        betweenSpacerPx: number,
        bottomSpacerPx: number,
      ) => ReturnType;
      clearPaginationBreaks: () => ReturnType;
    };
  }
}

export const Pagination = Extension.create({
  name: "pagination",

  addCommands() {
    return {
      setPaginationBreaks:
        (
          breakPositions: number[],
          topSpacerPx: number,
          betweenSpacerPx: number,
          bottomSpacerPx: number,
        ) =>
        ({ tr, dispatch }) => {
          const meta: PaginationMeta = {
            breakPositions,
            topSpacerPx,
            betweenSpacerPx,
            bottomSpacerPx,
          };
          tr.setMeta(paginationPluginKey, meta);
          if (dispatch) dispatch(tr);
          return true;
        },

      clearPaginationBreaks:
        () =>
        ({ tr, dispatch }) => {
          const meta: PaginationMeta = {
            breakPositions: [],
            topSpacerPx: 0,
            betweenSpacerPx: 0,
            bottomSpacerPx: 0,
          };
          tr.setMeta(paginationPluginKey, meta);
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<{ decorations: DecorationSet }>({
        key: paginationPluginKey,

        state: {
          init: () => ({ decorations: DecorationSet.empty }),
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(paginationPluginKey) as PaginationMeta | undefined;

            // Map decorations through document changes to keep widget positions stable.
            const mapped = prev.decorations.map(tr.mapping, tr.doc);

            if (!meta) {
              return { decorations: mapped };
            }

            // Rebuild decorations from the new break positions.
            // Clamp positions to the valid doc range.
            const clamped = meta.breakPositions
              .map((p) => Math.max(0, Math.min(p, newState.doc.content.size)))
              .filter((p, i, arr) => i === 0 || p !== arr[i - 1]);

            const decorations: Decoration[] = [];

            if (meta.topSpacerPx > 0) {
              decorations.push(
                Decoration.widget(
                  0,
                  () => {
                    const el = document.createElement("div");
                    el.className = "pm-page-top-spacer";
                    el.style.setProperty("--pm-spacer-height", `${meta.topSpacerPx}px`);
                    return el;
                  },
                  { side: -1 },
                ),
              );
            }

            if (meta.bottomSpacerPx > 0) {
              decorations.push(
                Decoration.widget(
                  newState.doc.content.size,
                  () => {
                    const el = document.createElement("div");
                    el.className = "pm-page-bottom-spacer";
                    el.style.setProperty("--pm-spacer-height", `${meta.bottomSpacerPx}px`);
                    return el;
                  },
                  { side: 1 },
                ),
              );
            }

            for (const pos of clamped) {
              if (meta.betweenSpacerPx <= 0) continue;
              decorations.push(
                Decoration.widget(
                  pos,
                  () => {
                    const el = document.createElement("div");
                    el.className = "pm-page-break";
                    el.style.setProperty("--pm-spacer-height", `${meta.betweenSpacerPx}px`);
                    return el;
                  },
                  { side: -1 },
                ),
              );
            }

            return { decorations: DecorationSet.create(newState.doc, decorations) };
          },
        },

        props: {
          decorations(state) {
            return paginationPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});
