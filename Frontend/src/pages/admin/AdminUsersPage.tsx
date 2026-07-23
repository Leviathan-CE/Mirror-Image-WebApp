/**
 * Admin — manage user accounts and roles.
 * Scaffold only; wire to admin user APIs next.
 */

import { AdminPageShell } from "@/pages/admin/AdminPageShell"

export function AdminUsersPage() {
  return (
    <AdminPageShell
      title="USERS"
      description="Review accounts and assign roles (user, distributor, admin). Management tools will land here."
    >
      <div className="border border-dashed border-cyan-500/30 bg-black/40 px-6 py-16 text-center">
        <p className="font-buahs93 text-lg text-cyan-200/80">
          USER MANAGEMENT COMING SOON
        </p>
        <p className="mt-2 text-sm text-white/50">
          Plan: search users, change role, disable accounts.
        </p>
      </div>
    </AdminPageShell>
  )
}
