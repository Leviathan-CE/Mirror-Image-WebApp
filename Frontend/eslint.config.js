import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'eslint-report.json']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Constants co-exported with components (buttonVariants, stack sizes, …).
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            "buttonVariants",
            "editBoxVariants",
            "hoverThumbPoint",
            "titleCaseTagWords",
            "useAuth",
            "cardClassification",
            "isClassifiedCard",
            "hashSeed",
            "flickerStyleForSeed",
            "collectTocSpyIds",
            "tocItemsFromHeadings",
          ],
        },
      ],
      // React Compiler–era hooks rules flag many existing playtester patterns
      // (refs during render, setState in fetch effects). Keep visible as warnings
      // so CI stays green while we refactor; treat new code carefully in review.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
])
