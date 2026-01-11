'use client'

import { TiptapEditor } from "@/app/components/TiptapEditor";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--app-canvas)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-6">
          <div className="text-sm text-gray-500">OpenSphere</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Document Editor</h1>
          <div className="mt-1 text-sm text-gray-500">
            US Letter pagination with print-accurate margins.
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/60 p-6 shadow-sm backdrop-blur">
          <TiptapEditor />
        </div>
      </div>
    </main>
  )
}

