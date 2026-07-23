/**
 * Admin — manage the cards database.
 * Scaffold only; CRUD UI comes after admin card APIs exist.
 */

import { AdminPageShell } from "@/pages/admin/AdminPageShell"

export function AdminCardsPage() {
  return (
    <AdminPageShell
      title="CARDS DB"
      description="Create, edit, and retire cards in the catalogue. Management tools will land here."
    >
      <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-16 text-center">
        <p className="font-buahs93 text-lg text-cyan-200/80">
          CARD MANAGEMENT COMING SOON
        </p>
        <p className="mt-2 text-sm text-white/50">
          Plan: list + search, edit fields, upload art, publish / unpublish.
        </p>
      </div>
    </AdminPageShell>
  )
}
