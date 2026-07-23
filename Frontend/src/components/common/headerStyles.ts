/**
 * Shared header chrome tokens.
 * Both BaseHeader and OperatorHeader import from here — change nav look once.
 */

export const headerShellClassName =
  "dark fixed inset-x-0 top-0 z-40 w-full bg-gradient-to-b from-black/90 via-black/50 to-transparent px-2 pt-2 pb-8 backdrop-blur-sm sm:px-4 lg:px-6 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
export const headerInnerClassName =
  "mx-auto flex max-w-6xl min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3 lg:gap-4"

export const headerBrandClassName =
  "font-glitch shrink-0 text-xs text-cyan-300 sm:text-sm md:text-base lg:text-xl"

export const headerNavClassName =
  "flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 sm:gap-1"

export const navButtonClassName =
  "font-buahs93 shrink bg-transparent px-1.5 text-[10px] leading-none text-white transition-colors hover:text-cyan-200 sm:text-xs md:text-sm"
export const headerUserNameClassName =
  "hidden max-w-[8rem] truncate font-buahs93 text-[10px] text-cyan-300/90 sm:inline sm:text-xs md:max-w-[12rem]"
