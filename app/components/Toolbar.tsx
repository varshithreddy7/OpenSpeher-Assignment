"use client";

import type { Editor } from "@tiptap/core";

export type ToolbarProps = {
  editor: Editor | null;
};

function ToolbarButton(props: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const { onClick, active = false, disabled = false, label } = props;

  const base =
    "px-2.5 py-1.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40";
  const enabled = active
    ? "bg-gray-900 text-white border-gray-900"
    : "bg-white/70 text-gray-800 border-[var(--app-border)] hover:bg-white";
  const disabledCls = "opacity-50 cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[base, disabled ? disabledCls : enabled].join(" ")}
    >
      {label}
    </button>
  );
}

function ToolbarGroup(props: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/60 p-1">
      {props.children}
    </div>
  );
}

export function Toolbar(props: ToolbarProps) {
  const { editor } = props;

  return (
    <div className="toolbar sticky top-3 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-white/70 p-3 shadow-sm backdrop-blur">
      <ToolbarGroup>
        <ToolbarButton
          label="H1"
          disabled={!editor}
          active={!!editor?.isActive("heading", { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          disabled={!editor}
          active={!!editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          disabled={!editor}
          active={!!editor?.isActive("heading", { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="P"
          disabled={!editor}
          active={!!editor?.isActive("paragraph")}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="B"
          disabled={!editor}
          active={!!editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          disabled={!editor}
          active={!!editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="• List"
          disabled={!editor}
          active={!!editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
      </ToolbarGroup>

      <div className="flex-1" />

      <ToolbarGroup>
        <ToolbarButton label="Print" disabled={!editor} onClick={() => window.print()} />
      </ToolbarGroup>
    </div>
  );
}
