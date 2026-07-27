// @ts-check
import { readFileSync } from 'node:fs';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const DOMAIN_VOCABULARY = JSON.parse(
  readFileSync(new URL('./.domain-vocabulary.json', import.meta.url), 'utf8'),
);

const VOCABULARY_PATTERN = `^(${DOMAIN_VOCABULARY.join('|')})$`;

const domainLiteral = (padre, literal, contexto) => ({
  selector: `${padre} > ${literal}[value=/${VOCABULARY_PATTERN}/]`,
  message: `Literal de dominio ${contexto}. Usa el diccionario: import { D } from '../domain'.`,
});

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Plantillas React Email: JSX puro. Las reglas type-aware de "unsafe" no
    // aplican bien al elemento JSX (se resuelve como `error`) y solo generan
    // ruido; el resto del linter sigue activo.
    files: ['src/email/templates/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    // El vocabulario del dominio sale de `.domain-vocabulary.json`, generado
    // desde el manifiesto: añadir una entrada allí actualiza este guard solo.
    // Los tests quedan fuera a propósito: una aserción de contrato debe usar el
    // literal, o se estaría probando a sí misma.
    files: ['src/**/*.ts'],
    ignores: ['src/domain/**', 'src/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        domainLiteral('BinaryExpression', 'Literal', 'en una comparación'),
        domainLiteral('VariableDeclarator', 'Literal', 'en una asignación'),
        domainLiteral('CallExpression', 'Literal', 'como argumento'),
        domainLiteral(
          'Property[computed=false]',
          'Literal.value',
          'como valor de propiedad',
        ),
        domainLiteral('ArrayExpression', 'Literal', 'en un arreglo'),
      ],
    },
  },
);
