<!-- 354d382e-d264-4052-843b-d0311e174e71 7dff78e4-2b56-49bf-8918-859a270eb307 -->
# Fix Frontend Build (Step 2)

## Goal

Produce a working production build and preview for the frontend by fixing Vite/PostCSS configuration and reinstalling required dependencies.

## Steps

### 1) Edit Vite config to minimal (no SWC, no custom PostCSS inline)

File: `C:\Users\muzam\OneDrive\Desktop\PROJECTS\Unicorns\MVPs\qiclife\qiclife\vite.config.ts`

Replace the entire file with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

### 2) Ensure PostCSS uses the standard config file

File: `C:\Users\muzam\OneDrive\Desktop\PROJECTS\Unicorns\MVPs\qiclife\qiclife\postcss.config.cjs`

Create (or replace) with:

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Note: Do not leave any `postcss.config.js` in the root; only the `.cjs` file above.

### 3) Install required dev dependencies

Run from project root:

```powershell
cd "C:\Users\muzam\OneDrive\Desktop\PROJECTS\Unicorns\MVPs\qiclife\qiclife"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
npm install -D vite@^5 @vitejs/plugin-react@^5 postcss@^8 autoprefixer@^10 tailwindcss@^3
```

### 4) Clear Vite optimized cache

```powershell
Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue
```

### 5) Reinstall and build

```powershell
npm install
npm run build
npm run preview
```

If `vite` is not recognized:

```powershell
npx vite build
npx vite preview
```

### 6) If you still hit PostCSS error

- Confirm only this file exists: `postcss.config.cjs`
- Ensure `postcss`, `autoprefixer`, and `tailwindcss` are in `devDependencies`
- Re-run:
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
npm run build
```


## Success Criteria

- `npm run build` completes without errors
- `npm run preview` serves a working app at the printed URL
- No SWC/“spack” or PostCSS module resolution errors appear

### To-dos

- [ ] Replace vite.config.ts with minimal React plugin config