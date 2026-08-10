/**
 * Admin — user accounts: roles, feature grants, invite, disable, delete.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { EditBox } from "@/components/ui/EditBox"
import { ApiError } from "@/lib/api/client"
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminFeatures,
  fetchAdminUsers,
  inviteAdminUser,
  patchAdminUser,
  type AdminUserItem,
  type FeatureCatalogItem,
  type UserRole,
} from "@/lib/api/users_admin"
import { cn } from "@/lib/utils"
import { AdminPageShell } from "@/pages/admin/AdminPageShell"

const PAGE_SIZE = 48
const ROLES: UserRole[] = ["user", "distributor", "admin"]

const primaryActionClassName =
  "font-buahs93 h-9 rounded-none bg-cyan-700 px-4 text-sm text-white hover:bg-cyan-900 disabled:opacity-60"

const secondaryActionClassName =
  "font-buahs93 h-9 rounded-none border border-cyan-500/35 bg-black/70 px-3 text-sm text-cyan-100 hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white disabled:opacity-60"

const dangerActionClassName =
  "font-buahs93 h-9 rounded-none border border-red-500/50 bg-black/70 px-3 text-sm text-red-200 hover:border-red-400 hover:bg-red-500/10 disabled:opacity-60"

const selectClassName =
  "h-9 rounded-none border border-cyan-500/35 bg-black/80 px-2.5 font-mono text-xs text-cyan-50 outline-none focus-visible:border-cyan-300"

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.detail) {
      case "cannot_delete_self":
        return "You cannot delete your own account."
      case "cannot_disable_self":
        return "You cannot disable your own account."
      case "cannot_demote_self":
        return "You cannot demote yourself."
      case "cannot_remove_last_admin":
        return "Cannot remove the last active admin."
      case "username_or_email_taken":
        return "Username or email already in use."
      case "email_not_configured":
        return "SMTP is not configured on the server."
      case "email_send_failed":
        return "Could not send email. Check SMTP settings."
      case "user_delete_blocked":
        return "Delete blocked (user still owns related data)."
      default:
        return error.detail
    }
  }
  return "Request failed."
}

export function AdminUsersPage() {
  const { token, user } = useAuth()
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("")
  const [activeFilter, setActiveFilter] = useState<"all" | "yes" | "no">("all")
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<AdminUserItem[]>([])
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null)

  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formRole, setFormRole] = useState<UserRole>("user")
  const [formFeatures, setFormFeatures] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [list, features] = await Promise.all([
        fetchAdminUsers(token, {
          q,
          role: roleFilter,
          is_active:
            activeFilter === "all" ? null : activeFilter === "yes",
          limit: PAGE_SIZE,
          offset,
        }),
        fetchAdminFeatures(token),
      ])
      setItems(list.items)
      setTotal(list.total)
      setCatalog(features)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [token, q, roleFilter, activeFilter, offset])

  useEffect(() => {
    void load()
  }, [load])

  function toggleFormFeature(key: string) {
    setFormFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setMessage(null)
    try {
      await createAdminUser(token, {
        user_name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
        feature_keys: formFeatures,
      })
      setMessage("User created — verification email sent.")
      setCreateOpen(false)
      setFormName("")
      setFormEmail("")
      setFormPassword("")
      setFormFeatures([])
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setMessage(null)
    try {
      await inviteAdminUser(token, {
        email: formEmail.trim(),
        user_name: formName.trim() || undefined,
        role: formRole,
        feature_keys: formFeatures,
      })
      setMessage("Invite email sent.")
      setInviteOpen(false)
      setFormName("")
      setFormEmail("")
      setFormFeatures([])
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function setRole(item: AdminUserItem, role: UserRole) {
    if (!token) return
    try {
      await patchAdminUser(token, item.id, { role })
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function setActive(item: AdminUserItem, is_active: boolean) {
    if (!token) return
    try {
      await patchAdminUser(token, item.id, { is_active })
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function toggleGrant(item: AdminUserItem, key: string) {
    if (!token) return
    const next = item.features.includes(key)
      ? item.features.filter((k) => k !== key)
      : [...item.features, key]
    try {
      await patchAdminUser(token, item.id, { feature_keys: next })
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function resendVerify(item: AdminUserItem) {
    if (!token) return
    try {
      await patchAdminUser(token, item.id, { resend_verification: true })
      setMessage(`Verification resent to ${item.email}.`)
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return
    try {
      await deleteAdminUser(token, deleteTarget.id)
      setMessage(`Deleted ${deleteTarget.user_name}.`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  return (
    <AdminPageShell
      title="USERS"
      description="Create and invite accounts, change roles, grant features without Stripe, disable or permanently delete users."
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex w-full min-w-0 flex-col gap-1 lg:min-w-[14rem] lg:flex-1">
          <span className="font-mono text-[10px] uppercase text-white/45">
            Search
          </span>
          <EditBox
            value={q}
            onChange={(e) => {
              setOffset(0)
              setQ(e.target.value)
            }}
            placeholder="username or email"
            className="w-full min-w-0"
          />
        </label>
        <div className="flex w-full flex-wrap items-end gap-3 lg:w-auto lg:shrink-0">
          <label className="flex min-w-[8rem] flex-1 flex-col gap-1 sm:flex-none">
            <span className="font-mono text-[10px] uppercase text-white/45">
              Role
            </span>
            <select
              className={cn(selectClassName, "w-full sm:w-auto")}
              value={roleFilter}
              onChange={(e) => {
                setOffset(0)
                setRoleFilter(e.target.value as UserRole | "")
              }}
            >
              <option value="">All</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[8rem] flex-1 flex-col gap-1 sm:flex-none">
            <span className="font-mono text-[10px] uppercase text-white/45">
              Active
            </span>
            <select
              className={cn(selectClassName, "w-full sm:w-auto")}
              value={activeFilter}
              onChange={(e) => {
                setOffset(0)
                setActiveFilter(e.target.value as "all" | "yes" | "no")
              }}
            >
              <option value="all">All</option>
              <option value="yes">Active</option>
              <option value="no">Disabled</option>
            </select>
          </label>
          <Button
            type="button"
            className={secondaryActionClassName}
            onClick={() => {
              setCreateOpen(true)
              setInviteOpen(false)
            }}
          >
            ADD USER
          </Button>
          <Button
            type="button"
            className={primaryActionClassName}
            onClick={() => {
              setInviteOpen(true)
              setCreateOpen(false)
            }}
          >
            INVITE
          </Button>
        </div>
      </div>

      {message ? (
        <p className="mt-3 text-sm text-emerald-300/90">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-300/90">{error}</p> : null}

      {(createOpen || inviteOpen) && (
        <form
          onSubmit={inviteOpen ? onInvite : onCreate}
          className="mt-4 border border-cyan-500/25 bg-black/50 p-4"
        >
          <h2 className="font-buahs93 text-cyan-200">
            {inviteOpen ? "INVITE USER" : "CREATE USER"}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/45">
                Username {inviteOpen ? "(optional)" : ""}
              </span>
              <EditBox
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required={!inviteOpen}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/45">Email</span>
              <EditBox
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </label>
            {!inviteOpen ? (
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] text-white/45">
                  Password
                </span>
                <EditBox
                  password
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-white/45">Role</span>
              <select
                className={selectClassName}
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="mt-3">
            <legend className="font-mono text-[10px] text-white/45">
              Feature grants
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {catalog.map((feature) => (
                <label
                  key={feature.key}
                  className="flex items-center gap-2 text-sm text-cyan-100"
                  title={feature.description}
                >
                  <input
                    type="checkbox"
                    checked={formFeatures.includes(feature.key)}
                    onChange={() => toggleFormFeature(feature.key)}
                  />
                  {feature.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className={primaryActionClassName}>
              {inviteOpen ? "SEND INVITE" : "CREATE"}
            </Button>
            <Button
              type="button"
              className={secondaryActionClassName}
              onClick={() => {
                setCreateOpen(false)
                setInviteOpen(false)
              }}
            >
              CANCEL
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto border border-cyan-500/20">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="bg-black/70 font-mono text-[10px] uppercase text-white/50">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Features</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelf = user?.id === item.id
              return (
                <tr
                  key={item.id}
                  className="border-t border-cyan-500/10 bg-black/40"
                >
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-cyan-100">
                      {item.user_name}
                    </div>
                    <div className="font-mono text-xs text-white/45">
                      {item.email}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <select
                      className={selectClassName}
                      value={item.role}
                      disabled={isSelf}
                      onChange={(e) =>
                        void setRole(item, e.target.value as UserRole)
                      }
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs">
                    <div
                      className={
                        item.is_active ? "text-emerald-300/90" : "text-red-300/80"
                      }
                    >
                      {item.is_active ? "active" : "disabled"}
                    </div>
                    <div
                      className={
                        item.email_verified
                          ? "text-white/45"
                          : "text-amber-300/90"
                      }
                    >
                      {item.email_verified ? "verified" : "unverified"}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      {catalog.map((feature) => (
                        <label
                          key={feature.key}
                          className="flex items-center gap-2 text-xs text-cyan-100/90"
                          title={feature.description}
                        >
                          <input
                            type="checkbox"
                            checked={item.features.includes(feature.key)}
                            onChange={() => void toggleGrant(item, feature.key)}
                          />
                          {feature.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={secondaryActionClassName}
                        disabled={isSelf}
                        onClick={() => void setActive(item, !item.is_active)}
                      >
                        {item.is_active ? "DISABLE" : "ENABLE"}
                      </Button>
                      {!item.email_verified ? (
                        <Button
                          type="button"
                          className={secondaryActionClassName}
                          onClick={() => void resendVerify(item)}
                        >
                          RESEND VERIFY
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        className={dangerActionClassName}
                        disabled={isSelf}
                        onClick={() => setDeleteTarget(item)}
                      >
                        DELETE
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-white/45"
                >
                  No users match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-white/45">
          {loading ? "Loading…" : `${total} user(s)`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            className={secondaryActionClassName}
            disabled={!canPrev || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            PREV
          </Button>
          <Button
            type="button"
            className={secondaryActionClassName}
            disabled={!canNext || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            NEXT
          </Button>
        </div>
      </div>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div className="w-full max-w-md border border-red-500/40 bg-black p-5">
            <h2
              id="delete-user-title"
              className="font-buahs93 text-lg text-red-200"
            >
              PERMANENT DELETE
            </h2>
            <p className="mt-3 text-sm text-white/70">
              This cannot be undone. Delete{" "}
              <span className="text-cyan-200">{deleteTarget.user_name}</span> (
              {deleteTarget.email})?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                className={secondaryActionClassName}
                onClick={() => setDeleteTarget(null)}
              >
                CANCEL
              </Button>
              <Button
                type="button"
                className={cn(dangerActionClassName, "border-red-400")}
                onClick={() => void confirmDelete()}
              >
                DELETE PERMANENTLY
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
