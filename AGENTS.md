# Repository Guidelines

## Project Structure & Module Organization
- `App.tsx` orchestrates chat, image, and video flows plus Google GenAI interactions.
- `components/` holds reusable views (`ChatInput`, `ChatMessage`, `ApiKeyModal`, `icons.tsx`); keep them presentation-focused.
- `services/geminiService.ts` wraps GenAI SDK access; extend it for new models to reuse key handling and polling.
- `utils/fileUtils.ts` stores binary helpers like `fileToBase64`; place shared utilities here.
- `types.ts` centralizes message, media, and mode types—update these before introducing new interfaces elsewhere.
- Core configuration lives in `vite.config.ts`, `tsconfig.json`, and `package.json`.

## Build, Test, and Development Commands
- `npm install` installs dependencies; rerun after changes to `package.json`.
- `npm run dev` launches the Vite dev server with hot reload; export `API_KEY` beforehand.
- `npm run build` generates a production `/dist`; run before release or when validating bundle size.
- `npm run preview` serves the built assets for local smoke-testing.

## Coding Style & Naming Conventions
- Use TypeScript, functional React components, four-space indentation, single quotes, and JSX formatting consistent with existing files.
- Name components with PascalCase (`ChatMessage`), utilities with camelCase (`handleDownload`), and prefix custom hooks with `use`.
- Keep state local when UI-specific; lift shared logic into `services/` or `utils/` before copying it.
- Compose styles with Tailwind-like class strings; reserve comments for non-obvious control flow or API nuances.

## Testing Guidelines
- Tests are not configured; add Vitest + React Testing Library under `__tests__/` next to the code under test.
- Cover multi-step flows (image editing, video polling) with integration-style cases, or document manual QA steps in the PR.
- Name test files `<Component>.test.tsx` or `<module>.test.ts` and focus assertions on user-visible behavior.

## Commit & Pull Request Guidelines
- Git metadata is absent in this snapshot; default to Conventional Commit titles (for example `feat: support video polling status`) in the imperative mood.
- Keep commits focused and include a short body covering problem, solution, and validation when complexity warrants it.
- Pull requests must link issues, list verification steps (`npm run build`, manual QA), and attach screenshots or clips for UI updates.

## Security & Configuration Tips
- Set `API_KEY=<Google GenAI key>` in your environment (for example `.env.local`) before issuing GenAI requests.
- Keep keys and generated media out of version control; rely on `.gitignore` or temp directories.
- The UI expects `window.aistudio` bindings; stub them when running stories, tests, or demos outside the Studio shell.
