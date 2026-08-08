# Mengkaile 3D DIY Designer

## What is implemented

- New `#/diy-designer` route linked from the catalog and desktop navigation.
- Three.js scene with orbit camera, lighting, shadows, grid, selection, move handles, and direct in-scene 90-degree rotation controls.
- MayCAD-style non-blocking collision feedback: movement and rotation stay applied while interfering profiles and project nodes are highlighted red until separated.
- Click-to-add and drag-to-canvas parts library for:
  - aluminum profiles (all existing profile variants),
  - aluminum plates,
  - aluminum pegboards,
  - marine boards,
  - corner brackets,
  - leveling feet.
- Live profile length, model, finish, color, quantity, position, and rotation editing.
- Live board width, height, thickness, color, quantity, position, and rotation editing.
- Profile drilling by face, position, and hole type, including threaded hole size.
- Left/right end tapping options.
- Colored 3D rendering using the existing Mengkaile color catalog.
- Pegboard hole pattern and marine-board grain visualization.
- Undo/redo, duplicate/delete, local save/load, and JSON export/import support.
- Demo workbench generator for onboarding and QA.
- Live pricing using the storefront's current profile, plate, pegboard, and marine-board rules.
- Conversion of a complete 3D assembly into the existing cart item formats, including production remarks, board area metadata, machining data, hardware quantities, and checkout compatibility.
- Designer screws preserve customer-edited quantities and export through the legacy factory reminder as compact rows grouped by profile model/series, head, length, color, and price; they do not stack with the ordinary per-hole 304-screw add-on.
- Lazy-loaded 3D bundle so regular catalog and checkout visitors do not download Three.js.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/#/diy-designer`.

## Production roadmap

1. Replace the simplified box-based profiles with exact CAD cross-sections generated from the production profile catalog.
2. Continue refining snapping constraints: endpoint, midpoint, slot, coplanar, perpendicular, equal spacing, and penetration-free snap candidates while preserving non-blocking manual transforms.
3. Add joints that understand manufacturing intent and automatically create matching brackets, screws, taps, and BOM rows.
4. Add a project API and database models so designs can be saved to user accounts and reopened across devices.
5. Store assembly relationships and stable part UUIDs on orders instead of relying only on cart remarks.
6. Add server-side price validation so browser estimates can never be used as authoritative checkout prices.
7. Generate production drawings, exploded views, cut lists, and drill-coordinate sheets from the saved assembly.
8. Add STEP/DXF/GLTF import/export after exact geometry and coordinate conventions are finalized.
9. Create a proper accessory catalog mapping for every connector, fastener, foot, hinge, handle, and panel mounting system.
10. Move Tailwind from the existing CDN setup into the Vite/PostCSS build before production deployment.

## Validation completed

- `npm run build` passes.
- The designer component passes a targeted TypeScript check.
- Browser-tested empty state, demo assembly generation, WebGL rendering, part selection, profile length update, drilling, live repricing, and full cart conversion.
- Browser-tested board areas and accessory quantities in the existing cart/production sheet.

The repository-wide `npx tsc --noEmit` still reports the pre-existing backend service alias error in `alufactory-backend/FRONTEND_SERVICE.ts` (`@/config` is not present in the frontend TypeScript project).
