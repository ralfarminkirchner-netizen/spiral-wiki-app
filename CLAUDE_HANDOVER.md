# Handover Context: Spiral Wiki App

## Current State
The Spiral Wiki App has just undergone a major performance and UI overhaul:

1.  **Image Audit & Fixes**: All 628 monographic entries have had their image URLs verified and fixed. Broken Wikimedia URLs and missing SVGs/TIFs have been systematically replaced with high-resolution, working imagery or deterministic thematic fallbacks.
2.  **Performance Optimization**: The UI was struggling to render 1800+ DOM nodes (images + labels + containers) for the spiral view. This was completely rewritten to use a **single HTML5 `<canvas>` element** for the spiral layout.
    *   Replaced 625 `position: absolute` DOM nodes with a 60fps `requestAnimationFrame` canvas drawing loop.
    *   Pan/Zoom operations are now handled directly on the transform state of the canvas without triggering React re-renders.
    *   Removed expensive CSS transitions, heavy `box-shadow` properties, and GPU-intensive `blur()` filters on the background.
    *   Hover effects are now calculated mathematically on the canvas (distance checks) to show a simple floating tooltip div.
3.  **Spiral Arm Balancing**: The user was unhappy with the "swastika-like" look of straight, uneven arms. 
    *   The spiral layout was adjusted to split large categories (e.g., Philosophie into I, II, III) and merge smaller related categories (e.g., Kunst & Natur) so that there are precisely **13 arms with roughly 48 entries each**.
    *   The arms now form a *true Archimedean spiral* using constant angular steps (`spiralTightness = 0.18`), which results in beautifully curved, uniform spiral arms instead of straight lines.
    *   The background guide lines now also follow these exact Archimedean curves instead of being straight linear gradients.

## Build Process
*   The Vite build is successful (`npm run build`).
*   The output is located in `dist/`.
*   Data generation scripts like `scripts/master-fix.py` govern the data integrity of `public/data.json` and `public/appData.js`.
*   *Important:* After building, `public/appData.js` must be copied to `dist/appData.js` so that the client application has the latest JSON-equivalent metadata.

## Next Steps for Claude Code
*   You are fully cleared to take over. The repository is in a clean Git state.
*   You can run `npm run dev` in `wiki-app` to start the local dev server.
*   The main entry points for the complex UI logic are `src/App.tsx` and `src/index.css`.
*   Review this `CLAUDE_HANDOVER.md` for context.
