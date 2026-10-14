import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  // `src/components/ui` lo genera y actualiza el CLI de shadcn-vue: no se lintea.
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'src/components/ui/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // Fija la raíz de tsconfig a este paquete: el editor lanza ESLint desde la raíz del monorepo y
  // typescript-eslint no sabría elegir entre `apps/api` y `apps/web`.
  {
    name: 'app/tsconfig-root',
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
