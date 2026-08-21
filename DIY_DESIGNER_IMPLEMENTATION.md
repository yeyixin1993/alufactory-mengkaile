# Mengkaile 3D DIY Designer

## What is implemented

- New `#/diy-designer` route linked from the catalog and desktop navigation.
- Three.js scene with orbit camera, lighting, shadows, grid, selection, six signed world-axis move handles, and direct in-scene 90-degree rotation controls. Left-drag always orbits; after selection, left-dragging a ±X/±Y/±Z arrow performs constrained movement, while right-click without dragging keeps the rotate/delete menu. Every accessory—including generated attached brackets—uses the same translation gizmo; moving one releases its old attachment. Black end-resize handles remain profile-only.
- The bottom-right control guide is an opaque high-contrast card: orbit, pan, and zoom are separate chips, and selected-part axis/right-click actions are kept on their own line for reliable readability over the 3D scene.
- A selected profile carries camera-following assembly dimensions for its length, connection-end clearances, and nearest unobstructed axis gaps. Actual non-interfering profile contacts stay highlighted in amber until the connection is broken. Shift-dragging a colored movement axis preserves the source profile and commits a moved copy; ordinary axis movement does not copy.
- Free draw supports live X/Y/Z world-axis turning, stable construction-plane starts, exact endpoint continuation/closure, and hard rejection of overlapping new members. Each existing profile end has a centre top/end-face hotspot plus four side-edge hotspots: centre starts a perpendicular top member, while a side hotspot locks to its side normal and aligns the new member's outside end flush. The initial 40mm ghost runs through the same anchor/section-offset transform as the committed part, so top and side previews stay perpendicular and do not jump by half a section after the first click. At a snapped structural start only the intended perpendicular axes remain eligible; collision scoring cannot substitute a misleading parallel preview. Shift-click toggles individual members and Shift-drag from empty canvas adds intersecting projected parts through a visible marquee. Ordinary property or rotation edits preserve the current inspection camera; automatic frame fitting occurs only when scene membership changes.
- Restore cursor is a contextual purple control in the 3D canvas upper-left while free draw, pointer-based accessory placement, or point-drilling is active. It is intentionally absent from the parts library and ordinary movement mode; clicking it or pressing Esc exits the active pointer tool.
- Persistent “Edit accessories” mode for real aligned 2020/3030-system perpendicular contacts: first choose No.1 outside corner bracket, No.5 groove connector, or drill-and-tap, then click purple points to add, orange points to replace, or green points to delete the chosen type. Add-all and delete-all operate on the current type across eligible joints. Profiles turn translucent during editing; generated relationships remain geometry-positioned, locked, and idempotent.
- Flat No.7 T/L plates are accepted only when both target profiles expose one coplanar exterior mounting face. Both resolve from the true 90-degree contact, fill the matched profile module, and require every corner of each real arm to remain supported: L starts both arms at the contact; T moves its visual origin half a module from the perpendicular butt face to the continuous profile centreline, centres its complete crossbar there, and starts its complete stem there. Each arm keeps two fasteners over its assigned profile. Third-profile blocking tests the real L/T footprints rather than their empty bounding rectangles. No.1 is a full-width die-cast corner seat (2020: 20/28mm legs and 20mm width; 3030: 30/30/30mm) with two face-normal socket fasteners. It installs only at the true inside corner of two perpendicular contacting profiles, where both seating faces remain flush and the cast body stays outside both extrusions.
- No.9 is an exact three-way end-connector cube: 1515/2020/3030 render as 15/20/30mm on every axis. Three mutually perpendicular profile ends seat flush on three mating faces; the opposite three exposed faces carry the circular installation openings. Legacy/imported dimensions are normalized to the selected series cube before rendering and export.
- MayCAD-style non-blocking collision feedback: movement and rotation stay applied while interfering profiles and project nodes are highlighted red until separated.
- Parts library for:
  - aluminum profiles through an inline all-model dropdown and direct two-click free draw, with no add-profile modal or loose default-length part,
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
- Designer and PDF screw specifications share catalog lengths: 2020 M6×30 cylinder / M6×20 button, and 3030 M8×45 cylinder / M8×20 button plus elastic fastener. The internal 3D shaft uses the same catalog length.
- Opaque assemblies render a linked counterbore/countersunk connection as a realistic silver seated socket head with only its exposed top lip visible; its amber/black machining helper, shaft, and spring fastener are hidden. Empty holes keep their machining symbols. Profile translucency reveals the complete internal shaft, fastener, and receiving tapped-profile relationship. This visual inspection rule applies to generated furniture and manually built projects without changing machining or BOM data.
- Linked through-hole connections show only the single camera-visible circular wrench/access opening while profiles are opaque; the opposite wall remains occluded. Their button head is seated internally at the mating slot, and the head, full shaft, receiving relation, and 3030 spring T-slot fastener are revealed only in translucent inspection mode. The 3030 elastic fastener is rendered as the physical shallow rectangular slot nut rather than a washer ring.
- Lazy-loaded 3D bundle so regular catalog and checkout visitors do not download Three.js.
- Build-time Tailwind CSS, local catalog artwork, idle product-page color preloading, and on-demand PDF/preview chunks so the storefront does not wait for runtime CSS generation, external placeholder images, or export libraries. Factory-sheet raster export uses the same stable sans-serif CJK font stack as its preview, explicit line boxes for long summary rows, and an integer 2× capture scale so downloaded PDF glyphs retain their preview baseline instead of shifting or clipping.
- Critical inline startup progress UI appears before the application bundle loads, reaches 100% only after React paints the first usable frame, and then fades away.
- MayCAD import: deterministic, editable `.scene` XML conversion. Customer-facing PDF/AI reconstruction is disabled until a future AI provider configuration and review workflow are ready.
- Parametric furniture entry points for the IKEA calligraphy-basket cabinet and wardrobe. The calligraphy cabinet is limited to 3000mm overall length and 1600mm overall height; its 12mm marine-board top stays one piece through 2440mm and otherwise splits on a supported profile divider. Every generated wardrobe column receives an inset 12mm UV board at the bottom frame, every selected storage level, and the top frame, each with 1mm clearance on all four sides and eight dedicated `12mm板专用层板托` at ¥0.7 each. Equal-column divisions retain exact centred frame coordinates, while every resulting marine-board cut length/depth is rounded down to a whole millimetre so three-column and other uneven divisions never export decimal or oversize panels. Storage-level frames use complete four-rail 2020 rectangles and flush No.1 rail-to-post corner brackets rather than the former drill-and-tap post connection. Every generated wardrobe profile remains capped at 3000mm. Both templates hand a fully editable scene, machining data, and production remarks into the same 3D designer.
- Other hardware now includes a fixed-black threaded-stem caster (M6/M8/M10/M12, brake/no-brake), the fixed-gold referenced 70×70mm adjustable foot (60-68mm, Ø28mm post, M8 adjustment point), and a color-selectable aluminum profile end cap bound to a specific profile end. The end cap automatically adds missing end tapping and only removes tapping that it added itself. Confirmed end-cap prices are 2020 ¥3 retail / ¥2.7 bulk and 3030 ¥4 retail / ¥3.5 bulk, with every color at the same price and the existing 20-piece same-line bulk threshold. Other end-cap sizes keep the clearly labelled provisional ¥6 natural / ¥8 colored fallback until confirmed; caster and foot estimates remain unchanged.
- Complete front profile frames automatically enable an auto-fit cabinet-door tool. Adjacent vertical boundaries split an N-column frame into N independently bound door leaves. Full-overlay leaves cover the frame while keeping a 2mm gap between neighboring leaves; inset/large-bend leaves fit inside each column's clear opening with a further 2mm perimeter gap. Doors can switch among aluminum, marine board, and aluminum pegboard; full overlay, half overlay, and inset/large-bend hinges; and left/right opening. The normal closed view keeps concealed hinges hidden and shows them only in translucent-profile inspection mode; handles remain visible, and a selected door always receives a clear cyan outline. JSON/XLSX/cart/factory data retain the door material, overlay, opening direction, hinge positions, frame relationship, and price metadata. The final production-sheet/PDF projection groups physically identical panels and door leaves by complete manufacturing specification and sums their quantities; generated location remarks are retained but do not split identical rows, while the editable designer scene, cart, JSON, and XLSX remain per-piece.
- Repository pre-push packaging: after `npm run setup:git-hooks`, each local push first rebuilds `dist` and replaces `~/Downloads/mengkaile-dist-latest.zip` with the current upload bundle.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/#/diy-designer`.

Enable the one-time local Git hook for automatic release ZIP generation:

```bash
npm run setup:git-hooks
```

The hook runs `npm run package:dist` before every push. A failed build or ZIP operation stops the push so the Downloads bundle cannot silently fall behind the source being pushed.

## Production roadmap

1. Replace the simplified box-based profiles with exact CAD cross-sections generated from the production profile catalog.
2. Continue refining snapping constraints: endpoint, midpoint, slot, coplanar, perpendicular, equal spacing, and penetration-free snap candidates while preserving non-blocking manual transforms.
3. Promote the initial generated connection keys into full editable joint entities, then expand automatic brackets, screws, taps, and BOM rules beyond No.1/No.5/drill-and-tap and the 2020/3030 systems.
4. Add a project API and database models so designs can be saved to user accounts and reopened across devices.
5. Store assembly relationships and stable part UUIDs on orders instead of relying only on cart remarks.
6. Add server-side price validation so browser estimates can never be used as authoritative checkout prices.
7. Generate production drawings, exploded views, cut lists, and drill-coordinate sheets from the saved assembly.
8. Add STEP/DXF/GLTF import/export after exact geometry and coordinate conventions are finalized.
9. Create a proper accessory catalog mapping for every connector, fastener, foot, hinge, handle, and panel mounting system.
10. Continue splitting route-specific storefront/editor code while preserving the completed Vite/PostCSS Tailwind build and on-demand PDF libraries.
11. Extend the constrained MayCAD scene schema into natural-language scene operations and image/sketch-assisted modeling, with human review before ordering.

## Validation completed

- `npm run build` passes.
- The designer component passes a targeted TypeScript check.
- Browser-tested empty state, demo assembly generation, WebGL rendering, part selection, profile length update, drilling, live repricing, and full cart conversion. Mouse regression coverage also verifies that left-drag orbits without changing the selected part's coordinates, all six signed axis entries are present, and exact movement changes only the chosen coordinate.
- Browser-tested accessory editing on the demo assembly: type selection closes the picker; purple/orange/green joint states support single add, replace, and delete; a replacement does not increase the part count; add-all installs all four eligible joints; delete-all returns all four to addable state and the original part count. Drill-and-tap single deletion also removes its linked screw and returns the joint to addable state.
- Browser-tested board areas and accessory quantities in the existing cart/production sheet.
- Browser-tested the default 1200×600×2200 wardrobe: the empty designer keeps the door disabled, the generated front frame enables it, full/half/inset produce 1196×2196 / 1176×2176 / 1156×2156mm, and material plus left/right-opening changes reach the 3D model, cart, and factory sheet. Test cart rows were removed afterward without touching the pre-existing customer row.
- Browser-tested `clothing_rack_2020.scene` import: 9 editable profiles, verified `2020`/`2020-N1` lengths, 12 imported Q11 countersunk holes, and a non-destructive review warning for four unsupported Q2 blind bores.

The repository-wide `npx tsc --noEmit` still reports two pre-existing errors outside this interaction change: the backend service alias in `alufactory-backend/FRONTEND_SERVICE.ts` (`@/config` is not present in the frontend TypeScript project) and a narrowed `window.setTimeout` call in `App.tsx`. The former designer `fastenerHead` normalization mismatch was resolved while adding generated drill-and-tap relationships.
