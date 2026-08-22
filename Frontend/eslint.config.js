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
      // Still common in data-fetch / prop-reset effects — keep warn until refactored.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
