import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";

export default [
  // Accessibility linting across the actual app surface (the React block below
  // only covers a narrow legacy glob). Scoped to a11y rules only so it surfaces
  // accessibility issues without cascading the full React ruleset.
  {
    files: ["src/app/**/*.{js,jsx}", "src/components/**/*.{js,jsx}"],
    ignores: ["src/components/ui/**/*"],
    // react-hooks is registered (not enforced here) so existing inline
    // `eslint-disable react-hooks/*` directives in app files resolve.
    plugins: { "jsx-a11y": pluginJsxA11y, "react-hooks": pluginReactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...pluginJsxA11y.flatConfigs.recommended.rules,
      // Intentional, accessible uses in this app:
      //  - autoFocus on inputs inside just-opened dialogs/search is good UX.
      //  - voice notes are user-generated audio; captions aren't feasible.
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/media-has-caption": "off",
    },
  },
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
