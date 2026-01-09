# Font Changer & Replacer - Feature Plan

## 1. Overview
A Figma plugin to scan, swap, and apply text styles across different scopes (Selection, Page, Document).
Users can see a list of all used fonts, select which ones to replace, and map them to new font families and styles.
This tool aims to simplify font migration and cleanup in large design files.

## 2. Specs & User Stories

### Core Flow
- **Story:** As a designer, I want to see all fonts used in my current selection so I can identify inconsistencies.
- **Story:** As a designer, I want to replace "Roboto Regular" with "Inter Medium" across the entire page with one click.
- **Story:** As a designer, I want to limit the scan to my current selection to avoid affecting the whole document accidentally.

### Key Features
- **Scope Control:** Dropdown to select scan target: Selection, Current Page, or Entire Document.
- **Font Mapping:** Row-based UI showing "Current Font" -> "Target Font" (Family & Style).
- **Batch Processing:** Replace multiple different fonts in a single operation.
- **Performance:** Optimized traversal to handle thousands of layers without freezing the UI.

## 3. Architecture & Tech Stack
- **Base:** `plugin-samples/esbuild-react` (React + Vite + esbuild).
- **UI:** React 18 for a responsive list of fonts.
- **Styling:** CSS Modules or plain CSS matching Figma's internal UI (Inter font, specific grays/blues).
- **Communication:** `onmessage` / `postMessage` bridge between UI (iframe) and Main (sandbox).

### Data Flow
1. **UI:** Sends `SCAN_FONTS` message with `scope` payload.
2. **Main:**
   - Traverses nodes based on scope.
   - Collects usage stats (count of text nodes per font).
   - Returns unique list of `{ family, style, count }`.
3. **UI:** Renders the list. User maps "Old Font" to "New Font".
4. **UI:** Sends `REPLACE_FONTS` message with `mapping` payload.
5. **Main:**
   - Pre-loads new fonts using `figma.loadFontAsync`.
   - Traverses nodes again.
   - Updates `fontName` property on matching nodes.
   - Reports progress/success back to UI.

## 4. Wireframe

```
+---------------------------------------------------------------+
|  Font Changer and Replacer                                 [x]|
+---------------------------------------------------------------+
|  [v] Current fonts (5)                   Replace with         |
+---------------------------------------------------------------+
|  [x] Roboto            Regular                                |
|      Scan found 12 layers                                     |
|      -> Replace with: [ Inter       v ]  [ Medium      v ]    |
+---------------------------------------------------------------+
|  [x] Comic Sans MS     Bold                                   |
|      Scan found 3 layers                                      |
|      -> Replace with: [ Comic Neue  v ]  [ Bold        v ]    |
+---------------------------------------------------------------+
|  ... (Scrollable list)                                        |
+---------------------------------------------------------------+
|  Scope: [ Current Page v ]                    [ Refresh ]     |
|                                                               |
|  [ Guide ] [ Community ]                  [ Change Fonts ]    |
+---------------------------------------------------------------+
```

## 5. Implementation Plan

### ✅ Step 1: Project Setup (Boilerplate)
- **Status:** ✅ Completed
- Initialize project using `esbuild-react` template.
- Verify build pipeline (`npm run build`).
- Verify plugin runs in Figma (Hello World).

**Files Created:**
- `manifest.json` - Plugin manifest
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite build config
- `plugin-src/code.ts` - Main plugin logic (scanner + replacer)
- `plugin-src/tsconfig.json` - TypeScript config for plugin
- `ui-src/App.tsx` - React UI component
- `ui-src/App.css` - Styling
- `ui-src/main.tsx` - React entry point
- `ui-src/index.html` - HTML template
- `ui-src/tsconfig.json` - TypeScript config for UI
- `.gitignore` - Git ignore rules

### Step 2: Font Scanning Logic (Backend)
- **Status:** ✅ Completed
- Implemented `getNodesForScope(scope)` helper for Selection/Page/Document.
- Implemented `findAllTextNodes(nodes)` with optimized stack-based traversal.
- Implemented `getFontRanges(node)` to handle mixed styles efficiently.
- Implemented `extractFontsFromTextNode(node)` to get unique fonts.

### Step 3: UI Implementation (Frontend)
- **Status:** ✅ Completed
- Built responsive font list with checkboxes and text inputs.
- Implemented scope tabs (Page/Selection/Document).
- Added dropdown-style inputs for font family and style.
- Auto-parse on plugin load and scope change.

### Step 4: Replacement Logic (Backend)
- **Status:** ✅ Completed
- Implemented `replaceFonts(scope, mappings)` with parallel font loading.
- Batch processing with progress updates for large files.
- Optimized range-based replacement to avoid index shifts.

### Step 5: Polish & Testing
- **Status:** ✅ Completed
- Added loading spinner with status text.
- Progress indicator for large replacements.
- Error handling with retry button.
- Empty state messaging.
- Indeterminate checkbox state.

## 6. Success Metrics
- **Performance:** Scans 1000 layers in < 1 second.
- **Accuracy:** Correctly identifies mixed styles in a single text node.
- **Usability:** User can perform a replacement in < 3 clicks.

## 7. Notes
- **Font Loading:** Critical. We must `await figma.loadFontAsync(newFont)` before assigning it, otherwise the plugin will crash.
- **Mixed Styles:** Text nodes can have multiple fonts. We must check `node.fontName`. If it's `figma.mixed`, we iterate `node.getRangeFontName(start, end)`.

---

## 8. Final Implementation Summary

### Files Created/Modified:
| File | Purpose |
|------|---------|
| `manifest.json` | Plugin metadata (name, permissions, entry points) |
| `package.json` | Dependencies and build scripts |
| `vite.config.ts` | Vite bundler configuration |
| `plugin-src/code.ts` | **Backend:** Font scanning + replacement logic |
| `plugin-src/tsconfig.json` | TypeScript config for sandbox |
| `ui-src/App.tsx` | **Frontend:** React UI component |
| `ui-src/App.css` | Figma-native styling |
| `ui-src/main.tsx` | React entry point |
| `ui-src/index.html` | HTML template |
| `ui-src/tsconfig.json` | TypeScript config for UI |
| `.gitignore` | Git ignore rules |

### Key Features Implemented:
1. ✅ **One-click scope control:** Selection, Page, Document tabs
2. ✅ **Mixed styles handling:** Detects and replaces fonts within text ranges
3. ✅ **High performance:** Stack-based traversal, batch processing, parallel font loading
4. ✅ **Controlled replacement:** Checkbox selection, manual font input, preview before apply
5. ✅ **Auto-parse:** Scans fonts automatically on load and scope change
6. ✅ **Progress indicator:** Shows percentage for large operations
7. ✅ **Error handling:** Graceful error states with retry option

### Build Command:
```bash
cd /Users/ludvighedin/Documents/Programming/figma-plugins/type-plugin
npm run build
```

### Test in Figma:
1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select `manifest.json` from this project
4. Run the plugin on a file with text layers

---
Last Updated: 2026-01-09
Status: ✅ Complete - Ready for Testing

