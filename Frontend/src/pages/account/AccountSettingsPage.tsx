/**
 * Account / Settings — deck and library defaults stored on the user.
 */

import { useEffect, useState } from "react"

import { useAuth } from "@/app/providers/AuthProvider"
import { useUserPreferences } from "@/app/providers/PreferencesProvider"
import { sharedImages } from "@/assets"
import { nextNewSectionName } from "@/components/decks/deck.logic"
import { DeckCardSortControls } from "@/components/decks/DeckCardSortControls"
import { DeckCardViewControls } from "@/components/decks/DeckCardViewControls"
import { GlitchFx } from "@/components/effects/GlitchFx"
import { SubscriptionSettingsPanel } from "@/components/billing/SubscriptionSettingsPanel"
import {
  BROWSE_WIDTH_MAX,
  BROWSE_WIDTH_MIN,
  LIBRARY_PAGE_SIZES,
  LIBRARY_SORT_OPTIONS,
  PREVIEW_PX_MAX,
  PREVIEW_PX_MIN,
  SECTION_COUNT_MAX,
  SECTION_COUNT_MIN,
  SECTION_NAME_MAX,
  clampBrowseWidth,
  clampPreviewPx,
  isLibraryPageSize,
  isLibrarySortMode,
  normalizeStartSections,
} from "@/lib/userPreferences.logic"

const fieldClassName =
  "font-buahs93 h-8 rounded-none border border-cyan-500/30 bg-black/80 px-2 text-xs tracking-wide text-cyan-100 outline-none hover:border-cyan-400/50 focus-visible:border-cyan-400"

export function AccountSettingsPage() {
  const { user } = useAuth()
  const { prefs, patchPrefs } = useUserPreferences()
  const [sectionDraft, setSectionDraft] = useState(prefs.deck_start_sections)

  useEffect(() => {
    setSectionDraft(prefs.deck_start_sections)
  }, [prefs.deck_start_sections])

  function patchSettings(patch: Parameters<typeof patchPrefs>[0]) {
    patchPrefs(patch, { syncToServer: true })
  }

  function commitSections(next: string[]) {
    const cleaned = normalizeStartSections(next)
    setSectionDraft(cleaned)
    patchSettings({ deck_start_sections: cleaned })
  }

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `url(${sharedImages.ZONE_BACKGROUND})` }}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-3xl pt-14">
        <header className="mb-8 border-b border-cyan-500/20 pb-5">
          <p className="font-buahs93 text-xs tracking-widest text-cyan-400/70">
            ACCOUNT
          </p>
          <h1 className="font-glitch mt-1 text-3xl text-cyan-300 sm:text-4xl">
            SETTINGS
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Account defaults, starting sections, and subscription. Signed-in
            choices follow your account
            {user ? ` (${user.user_name})` : ""}.
          </p>
        </header>

        <SubscriptionSettingsPanel />

        <section className="mb-6 border border-cyan-500/25 bg-black/50 p-5">
          <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
            DECKS
          </h2>
          <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
            Used when you open a deck. You can still change view and sort on the
            deck page.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <DeckCardViewControls
              value={prefs.deck_view}
              onChange={(deck_view) => patchSettings({ deck_view })}
            />
            <DeckCardSortControls
              value={prefs.deck_sort}
              onChange={(deck_sort) => patchSettings({ deck_sort })}
            />
            <label className="cliped-angle inline-flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                LIBRARY PANEL WIDTH
              </span>
              <input
                type="number"
                min={BROWSE_WIDTH_MIN}
                max={BROWSE_WIDTH_MAX}
                value={prefs.deck_browse_width_px}
                aria-label="Deck library panel width"
                className={fieldClassName}
                onChange={(event) =>
                  patchSettings({
                    deck_browse_width_px: clampBrowseWidth(
                      Number(event.target.value)
                    ),
                  })
                }
              />
              <span className="font-mono text-[10px] text-cyan-100/50">px</span>
            </label>
          </div>

          <div className="mt-6 border-t border-cyan-500/15 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-buahs93 text-xs tracking-wide text-cyan-100">
                  STARTING SECTIONS
                </h3>
                <p className="mt-1 font-mono text-[11px] text-cyan-100/45">
                  Names used when you create a new deck. Pilot is always its own
                  reserved slot — do not add it here. You can still add or rename
                  sections on a deck after it exists.
                </p>
              </div>
              <GlitchFx
                type="button"
                label="ADD SECTION"
                disabled={sectionDraft.length >= SECTION_COUNT_MAX}
                className="font-buahs93 h-9 shrink-0 rounded-none bg-cyan-700 px-5 hover:bg-cyan-900 disabled:opacity-60"
                onClick={() =>
                  commitSections([
                    ...sectionDraft,
                    nextNewSectionName(sectionDraft),
                  ])
                }
              />
            </div>
            <ul className="mt-3 space-y-2">
              {sectionDraft.map((name, index) => (
                <li
                  key={`section-row-${index}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <label className="cliped-angle inline-flex min-w-0 flex-1 items-center gap-2">
                    <span className="w-6 shrink-0 font-mono text-[10px] text-cyan-500/70">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      maxLength={SECTION_NAME_MAX}
                      value={name}
                      aria-label={`Starting section ${index + 1} name`}
                      className={`${fieldClassName} min-w-0 flex-1`}
                      onChange={(event) => {
                        const next = [...sectionDraft]
                        next[index] = event.target.value
                        setSectionDraft(next)
                      }}
                      onBlur={(event) => {
                        const next = [...sectionDraft]
                        next[index] = event.currentTarget.value
                        commitSections(next)
                      }}
                    />
                  </label>
                  {sectionDraft.length > SECTION_COUNT_MIN ? (
                    <GlitchFx
                      type="button"
                      label="REMOVE"
                      className="font-buahs93 h-8 shrink-0 rounded-none border border-cyan-500/40 bg-black/70 px-3 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/10"
                      onClick={() =>
                        commitSections(
                          sectionDraft.filter((_, i) => i !== index)
                        )
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border border-cyan-500/25 bg-black/50 p-5">
          <h2 className="font-buahs93 text-sm tracking-wide text-cyan-100">
            CARD LIBRARY
          </h2>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="cliped-angle inline-flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                SORT
              </span>
              <select
                value={prefs.library_sort}
                aria-label="Library sort"
                className={fieldClassName}
                onChange={(event) => {
                  const next = event.target.value
                  if (!isLibrarySortMode(next)) return
                  patchSettings({ library_sort: next })
                }}
              >
                {LIBRARY_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="cliped-angle inline-flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                PAGE SIZE
              </span>
              <select
                value={prefs.library_page_size}
                aria-label="Library page size"
                className={fieldClassName}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!isLibraryPageSize(next)) return
                  patchSettings({ library_page_size: next })
                }}
              >
                {LIBRARY_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="cliped-angle inline-flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-wide text-cyan-500/70">
                CARD SIZE
              </span>
              <input
                type="range"
                min={PREVIEW_PX_MIN}
                max={PREVIEW_PX_MAX}
                step={4}
                value={prefs.library_preview_px}
                aria-label="Library preview card size"
                className="h-2 w-40 cursor-pointer accent-cyan-400"
                onChange={(event) =>
                  patchSettings({
                    library_preview_px: clampPreviewPx(
                      Number(event.target.value)
                    ),
                  })
                }
              />
              <span className="font-mono text-[11px] text-cyan-200/80">
                {prefs.library_preview_px}px
              </span>
            </label>
          </div>
        </section>
      </div>
    </section>
  )
}
