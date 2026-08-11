# Mengkaile 3D DIY Designer — Project Knowledge

Last consolidated: 2026-08-08

This document is the durable product and engineering memory for the Mengkaile 3D DIY designer. It consolidates the decisions made during the initial implementation and subsequent user-testing iterations. It is intentionally more specific than a conventional roadmap because many details affect whether customer intent can be manufactured correctly.

## 1. Product goal

Build a browser-based aluminum-profile design and ordering workflow for `mengkaile.top` that combines:

- the visual product library, connection-part presentation, machining workflow, and ordering path seen in JLCFA;
- the smooth camera, movement, rotation, and profile-joining experience associated with MayCAD;
- Mengkaile's existing 2D aluminum-profile configuration, pricing, cart, production sheet, color catalog, pegboard, aluminum board, and marine-board workflows.

The designer is not only a 3D drawing toy. Its primary purpose is to capture unambiguous manufacturing intent, let the customer verify that intent visually, and carry the same intent into the cart, PDF, JSON, and Excel production data.

Do not copy competitor branding, source code, or assets. Competitor products are interaction and visual references only.

## 2. Core product principles

1. **Manufacturing truth over visual approximation.** A pretty model is not sufficient if the A/B/C/D face, groove, end distance, tapping port, screw, or color can be misunderstood by the factory.
2. **Direct manipulation first.** A customer should be able to select and drag a part from anywhere on its visible geometry. Numeric dialogs are for precision, not a barrier to ordinary movement.
3. **Helpful snapping without captivity.** Profiles should connect easily, remain snapped while the customer is aiming, and detach without noticeable resistance.
4. **One source of truth.** Stable item IDs, physical groove IDs, dimensions, transforms, machining, tapping, accessories, colors, remarks, and relationships must survive save/load and every export.
5. **Customer and factory must see the same meaning.** 3D presentation may change with camera orientation, but production descriptions use a canonical coordinate convention.
6. **Progressive visual detail.** The assembly remains readable at normal zoom; machining and internal fasteners become clearer through transparency, machining-mark mode, selection, or closer zoom.

## 3. Current entry points and page behavior

- Designer route: `#/diy-designer`.
- The designer should open in a new browser window/tab from its dedicated entry rather than replacing an active shopping workflow.
- The regular homepage banner must retain the original history content. Do not put “3D DIY” back into that banner.
- Desktop and mobile headers retain the original logo, brand text, history, language, login, and cart controls.
- The designer must remain usable on mobile. Do not implement desktop-only assumptions that leave the WebGL canvas blank.
- A special full-screen mode was considered and explicitly deferred. Do not add it unless requested again.

## 4. Designer layout and information architecture

- Left: a compact parts library grouped into profiles, boards, and connections/fasteners.
- The profile library exposes one **铝型材 / Aluminum profile** entry. Adding it opens a selector for both profile specification and length; default length is 200 mm.
- Center: the 3D workspace with camera controls, direct manipulation, selection, snapping, machining placement, and view controls.
- Right: when nothing is selected, show the project structure/summary. When one item is selected, show its properties and machining. Multi-selection shows batch operations.
- Each scene element has its own remark. The remark is visible in the project structure and must survive JSON, Excel, cart, and production output.
- File actions should be grouped rather than presented as a long toolbar: JSON actions together and Excel actions together.
- “一键填充螺丝 / Auto-fill screws” is a useful assembly action, but should live with connection/machining tools rather than clutter the primary file toolbar.

## 5. Selection and direct manipulation

- Clicking any visible part of a profile, board, or accessory selects that exact item. Do not restrict selection to a small hotspot.
- Closely spaced objects must be resolved by the foremost raycast hit. Avoid proxy geometry that causes the neighboring profile to be selected.
- Clicking empty canvas deselects the current item. In drilling mode it also exits drilling and returns to Move.
- Once selected, dragging anywhere on the object moves it freely in the active work plane. There is no purple-square handle and no acrylic selection罩/box.
- Keep the red, green, and blue transform arrows. Clicking an arrow immediately opens the numeric movement control and moves only along that axis. Ordinary free dragging must not open or trail a dialog.
- Numeric movement/length controls must close after Apply or Cancel and must never follow the cursor indefinitely.
- Profiles have black end handles at both ends for lengthening/shortening. Show the current length during the gesture and permit exact numeric entry.
- Right-click context actions include the three 90-degree rotations and Delete.
- Because customers may not discover the context menu, selecting an unlocked item also exposes the three colored 90-degree rotation controls directly over the scene. Keep a visible scene hint that right-click offers rotation/delete while right-drag orbits the camera.
- `Delete` and `Backspace` delete the selected item(s) when focus is not inside an editable control.
- Shift-click toggles individual items. Shift-drag creates a marquee selection. Every selected item needs a clear visible highlight so customers can verify batch selection.
- Provide undo/redo and a **显示全部 / Frame all** view reset that fits every drawn element after the user gets lost while zooming or orbiting.
- Allow enough zoom-in range to inspect screw and machining geometry.

## 6. Camera and rotation rules

- Camera orbit, pan, and zoom should feel continuous and low-friction, using MayCAD as the primary feel reference.
- Rotation is always in 90-degree increments around three colored axes.
- Wording standard: “绕红轴 / green axis / blue axis 90°”. The helper text defines the viewpoint: looking in the arrow direction, rotation is clockwise.
- Repeated rotation must work indefinitely. Four clicks around the same axis equal 360 degrees and must return the object to its original orientation, within floating-point tolerance.
- Rotation around the profile's own longitudinal axis is required so customers can change which slot or covered face is oriented outward.
- Movement, numeric movement, duplicate-and-move, and rotation remain available even when profiles intersect. Do not roll the transform back or show a blocking dialog.
- While interference exists, highlight every involved profile and project-tree node in red and show a non-blocking scene warning. The warning clears automatically after the customer moves or rotates the profiles apart.
- Magnetic snapping should still prefer valid face-to-face joints and skip snap candidates that would create solid penetration; this does not prevent a customer from manually placing an intentionally overlapping intermediate state.

## 7. Snapping and connection intent

Snapping is the highest-risk interaction area and must be tested in all orientations.

### 7.1 Trigger rules

- Profile-to-profile snapping triggers only when the intended contact faces are coplanar or within a small plane tolerance.
- Slot faces connect to slot faces. For multi-slot profiles, target a specific slot centerline rather than the center of the wide face.
- A 2040 wide face can accept two 2020 profiles on its two slot centerlines. Do not force a 2020 into the middle of the 40 mm face.
- Prefer end-based structural joints. Profiles normally meet flush without unwanted protruding ends.

### 7.2 Standard snap choices

For ordinary joints, expose three stable alignment candidates along the relevant direction:

- previous/near position;
- same line/center position;
- next/far position.

These correspond to the common module-aligned connection states seen in MayCAD/JLCFA. For 2040-to-2020 joints, normal states are full coverage, no coverage, or a 20 mm module offset. A nonstandard 30 mm overlap is allowed only through explicit numeric positioning; it should not be a preferred magnetic result.

### 7.3 Feel and stability

- Use a screen-space capture radius so snapping remains useful when “显示全部” makes the model small. Do not require extreme zoom-in.
- Use a wider acquisition range plus hysteresis/short hold delay so the preview does not flash and disappear while dragging.
- Once a candidate is acquired, keep it stable until the pointer clearly favors another candidate or exits a larger release threshold.
- Separation must be frictionless: snapping helps on approach but adds no extra resistance when the user intentionally drags away.
- Magnetic candidates that would place two solid profiles in the same volume are skipped. Manual movement/rotation may temporarily create interference and uses the non-blocking red warning defined in section 6. Contact at a face or valid structural joint is allowed.

## 8. Aluminum profile geometry

- Profiles must be generated from one coherent cross-section and extruded once. Do not stack several approximate models that look glued together.
- Exterior slots, lips, center bores, cavities, covered faces, and end sections should resemble the real catalog cross-section at both normal view and close zoom.
- Exact catalog/production drawings are authoritative. Existing storefront cross-section diagrams should be reused as references where available.
- 2020, 2040, and other multi-slot forms must not be generic rectangular beams.
- 2020R and 3030R have rounded/curved exterior faces and are not ordinary square profiles.
- `2020-N4-RD` is rounded but not a mathematically perfect full circle; model it from its cross-section drawing.
- 2047 is a special section. Its rendered section and machining map must show three end-tapping positions per end.
- Current profile catalog IDs and prices live in `constants.ts`; geometry and machining behavior must remain keyed by stable variant ID, not display name.

## 9. Color and material rules

- The designer uses Mengkaile's existing color pattern. The separate **表面处理 / surface treatment** choice is intentionally omitted for now and may return later.
- `银白 / Silver White` is the light natural aluminum appearance.
- `亮银色 / Bright Silver` is slightly darker with a stronger bright/reflective feel.
- Bright Silver uses the same price tier as other decorative colors. Only Silver White uses the natural-price tier.
- Green ordering and rendering: 冷清绿 is darkest, 松绿 is medium, 柳绿 is lightest. Current designer hex references are approximately `#28584d`, `#4f8262`, and `#89ad72` respectively; update together with the authoritative color swatches if the catalog changes.
- Aluminum plate and pegboard default to Silver White.
- Pegboard defaults to the IKEA-style hole pattern.
- Marine board defaults to natural wood. The design `wood_natural` value must export/order as `原色 / Original`, including cart and PDF.
- Marine board is a continuous board surface. Do not render horizontal battens/strips that do not exist in the product.
- Connection accessories 1, 2, 5, 7, and 9 default to Silver White.

## 10. Drilling and tapping semantics

### 10.1 Hole placement workflow

1. Customer activates “点选打孔”.
2. Customer first chooses hole type: through, countersunk, or threaded.
3. Customer clicks the intended profile face/slot.
4. A compact numeric editor shows detected entry face, groove, diameter/thread, position, and distances to both profile ends.
5. Customer confirms; clicking outside cancels drilling and returns to Move.

### 10.2 Physical hole model

- A through hole passes through the entire profile. If entered on A, the exit is visible on C; B exits D.
- A countersunk hole has a larger recess on the entry face only. The opposite face remains a normal through-hole exit.
- Hole overlays must remain legible from every camera angle. Countersunk circles must not appear heavily clipped because a decal intersects the surface.
- A through-hole visual diameter must not exceed the usable slot width.
- Threaded holes use a dashed/thread cue so they cannot be mistaken for through holes.
- Machining indicators should be readable without covering one another; use selected-item emphasis, leader/offset marks, transparency, and machining-mark mode instead of piling every label at the same depth.

### 10.3 Canonical faces and grooves

- A/B/C/D are canonical manufacturing faces, not camera-relative labels.
- Store `entryFace` plus a physical groove identifier/index. Derive the displayed groove ordinal for the currently described face.
- Opposite mappings: A ↔ C and B ↔ D.
- For a two-groove wide side, displayed groove order reverses on the opposite face. Example: B面第一槽 = physical P1 = D面第二槽.
- The production PDF/Excel must show both entry and exit paths so customer and factory can verify the same hole.

### 10.4 End tapping

- Show end tapping directly on the profile end face using red indicators, not yellow.
- Support no tapping, left end only, right end only, and both ends.
- Multi-port sections expose each port independently. 2040-class multi-bore profiles can have multiple ports; 2047 has three ports per end.
- Port count and location come from the real cross-section, never from a generic single-center assumption.

## 11. Screws and connection hardware

- Auto-fill mapping is a Mengkaile product rule:
  - countersunk hole → cylinder-head socket screw;
  - through hole → button-head socket screw;
  - threaded hole → no automatic screw.
- Automatically filled screws default to Silver White/natural, not black or another expensive decorative color.
- Screw heads should not protrude outside the profile envelope. The shaft passes through the first member and extends into the matching tapping channel/port of the second member to communicate the connection intent.
- Transparency mode should make internal screw paths readable. Normal mode should avoid excessive visual clutter.
- Individual socket-head screws and leveling feet are currently hidden from the parts library. Existing saved designs containing them remain load-compatible.
- The legacy cart checkbox “需要配304螺丝” remains the source for ordinary non-designer orders. A designer order with explicit screw items uses the customer-confirmed designer quantities instead; explicit designer screws take precedence and must not also incur the legacy per-hole screw fee.
- Factory/customer PDFs always retain the prominent “螺丝配件提醒：需要配螺丝” whenever either source requests screws. Preserve the legacy per-profile quantity wording for ordinary orders; designer orders display their confirmed quantities in the same summary area.
- Designer screw rows are compacted by source profile model/compatible series, head type, length, color, and unit price. The PDF shows one compact screw-summary section with a few specification rows, not one full accessory card per physical screw. Customer quantity edits in the designer are authoritative and survive cart/PDF/production output.
- For the 20-series system, the purchasing/PDF specifications are fixed catalog SKUs: cylinder-head socket = M6×30, button-head socket = M6×20, and the wardrobe flat-head socket override = M6×8. A dynamically fitted shaft length used only to make the 3D model penetrate the receiving profile is rendering metadata and must never replace the purchasing length in cart/PDF output.

## 12. Connection accessory catalog

Availability and price must be verified against Mengkaile's authoritative catalog before production release. The current implemented matrix is:

| Part | Meaning | Available series | Geometry rules |
| --- | --- | --- | --- |
| No.1 | Corner bracket | 2020, 3030 | Triangular form; no unnecessary protruding ends. Must remain visually distinct from No.2. |
| No.2 | Extruded corner bracket | 1515, 2020, 3030 | Extruded-bracket form; do not reuse No.1 geometry. |
| No.5 | Hidden bracket | 2020, 3030 | Hidden connector with one fastening hole on each mounting face. |
| No.7 L | L connecting plate | 1515, 2020, 3030, 4040 | 2 mm thick. 1515 and 2020 share one physical size/model. |
| No.7 T | T connecting plate | 1515, 2020, 3030, 4040 | 2 mm thick. 1515 and 2020 share one physical size/model. |
| No.9 | Three-way connector | 1515, 2020, 3030 | Simple cubic body without three decorative protrusions. Dimensions are 15³, 20³, or 30³ mm by series. |

- These accessories default to Silver White.
- Bright Silver is priced as a decorative color, the same tier as other colors.
- Compatibility filtering must hide impossible size/part combinations rather than letting the customer create them.
- Designer SVGs represent simplified 3D/vector geometry only.
- Physical-product JPGs under `public/images/accessory/` must never be overwritten by SVGs. JPGs are the authoritative visual references for the storefront, cart, customer PDF, and factory PDF.

## 13. Save, load, export, cart, and production

### 13.1 Local design files

- Initial persistence is file-based and local; do not silently depend on cloud storage or browser cache.
- **Save design JSON** downloads an editable source document.
- **Open local JSON** restores the complete editable assembly.
- The JSON source must preserve stable IDs, item kind/model, dimensions, color/material, transform, quantity, remark, holes, physical groove mapping, tapping ports, accessories, screw-hole links, and future joint relationships.

### 13.2 Production files

- **Production JSON** is a factory-oriented structured export.
- **Production Excel** must be a real `.xlsx` ZIP workbook, never SpreadsheetML/XML renamed to `.xlsx`.
- **Open local Excel** reads a designer-generated workbook and reconstructs the item list and estimate. Unsupported workbooks should fail clearly rather than partially guessing.
- Every profile row includes model, length, color, quantity, transform/assembly identity as needed, remark, hole details, tapping details, and pricing inputs.
- Machining sheets use canonical A/B/C/D faces, physical groove IDs, entry/exit descriptions, and both end distances.
- Cart conversion and the production PDF must preserve marine-board “原色”, accessory specifications, physical-product image keys, and all customer remarks.
- Cart/PDF conversion must preserve designer screw length, head type, compatible profile series, source profile model, color, customer-confirmed quantity, price, and linked profile/hole references while grouping identical screw specifications.
- Customer/factory PDF remarks contain only customer-entered or manufacturing-relevant notes. Scene position, rotation, “3D design”, and other editable-model transport metadata stay in JSON/XLSX and must not be appended to the visible remark column.
- A production-sheet preview with no selected shipping address or a displayed shipping fee of zero is labelled freight collect/到付/着払い. It must not imply ordinary prepaid courier service before the complete address, shipping, PDF, and payment flow has run.
- Shipping-weight baseline for marine board must use area multipliers: 12mm = 8 kg/㎡ and 18mm = 12 kg/㎡. If any legacy value differs, this baseline is authoritative.
- Client-side prices are estimates. A production deployment needs server-side validation against the current catalog before checkout totals become authoritative.

### 13.3 MayCAD interoperability

- MayCAD `.scene` files are XML and contain authoritative per-profile transform matrices and machining locations. Import them deterministically in the browser; do not spend AI tokens when the source scene is available.
- MayCAD profiles extrude along local +Y, while Mengkaile profiles use local +X. Convert the complete basis and center point, preserve one editable item per physical member, and keep source IDs in remarks for review.
- Verified 20-series mappings include `2020/43SP` → `2020`, rounded `21SP` → `2020R`, adjacent-face `22SP` → `2020-N2`, opposite-face `23LP` → `2020-N2-OPP`, one-face `33SP` → `2020-N1`, and all approved `2040/44SP/64SP` variants → ordinary `2040`. MayCAD does not provide a Mengkaile-equivalent covered-face 2040 in this verified set. For 30×30, Soft/Q variants map to `3030R`, two-face 3002 and `.22` variants to `3030-N2`, 3H/3003 variants to `3030-N1`, and ordinary 4H 3030L/SP variants to `3030`; Mengkaile currently has no separate opposite-face 3030 SKU. Approved 3060, 4040, and 4080 variants normalize to their ordinary Mengkaile models. Keep `docs/MAYCAD_PROFILE_MAPPING.md`, the importer, and the PDF AI prompt synchronized.
- A MayCAD assembly PDF contains BOM, machining tables, orthographic views, and isometric/exploded images, but no embedded editable scene coordinates. PDF/image AI reconstruction is deferred and disabled in the current product; normal local and production deployments require no AI provider or API key.
- There is no active customer PDF entry point, frontend API method, or registered backend AI route. Experimental reconstruction code may remain for future evaluation only. If enabled in a later release, every inferred import must be editable and carry confidence and review warnings; never silently claim manufacturing certainty for inferred face orientation, hidden members, machining, tapping, color, boards, or accessories.
- Imported MayCAD blind bores are not equivalent to Mengkaile end tapping. Unsupported blind bores remain review warnings rather than being converted into fabricated machining intent.
- Exact verified MayCAD profile codes may import directly. Every unverified or unknown `.scene` profile must open a post-import model confirmation step, grouped by source code and cross-section where possible, with the dimension-based fallback shown only as a suggestion. Model confirmation precedes the tapping prompt.
- The current MayCAD import scope is profiles plus recognized drilling records only. Accessories, fasteners, and connectors are not imported yet; the UI must state that accessory import is under development in both the import review and confirmation flow.
- The customer-facing MayCAD import picker accepts `.scene` files only. Filter the picker to `.scene` by default and reject any PDF, image, renamed document, or other extension before parsing with a localized instruction to choose a MayCAD-exported `.scene` file. Experimental PDF reconstruction is not exposed, and its backend blueprint is not registered unless a future deployment explicitly sets `ENABLE_MAYCAD_AI_IMPORT=1` after provider readiness.

## 14. STEP/STP interoperability direction

The requested long-term workflow is similar to a profile-quote page:

- upload STEP/STP;
- identify/list parts for customer verification;
- map recognized profiles and machining to Mengkaile catalog items;
- create a cart directly or import the recognized assembly into the designer for editing.

Recommended architecture:

1. Keep editable designer JSON as the native source of truth.
2. Implement server-side STEP parsing and geometry recognition; browser-only parsing is not sufficient for reliable manufacturing interpretation.
3. Require a customer verification table for model, length, color, machining, quantity, and recognition confidence before cart conversion.
4. Separate “assembly STEP for external CAD” from “manufacturing STEP/cut parts”.
5. Do not promise round-trip STEP fidelity until exact profile B-reps/CSG, boolean drilling, coordinate conventions, units, and accessory models are finalized.

STEP import/export is a roadmap item, not a currently guaranteed feature.

## 15. Visual reference lessons

### From MayCAD

- Camera orbit/pan/zoom and profile dragging should feel smooth and predictable.
- Profiles should be easy to bring onto the same working plane.
- Standard modular connection placements should be offered while dragging.
- Rotation controls must make longitudinal self-rotation obvious.

### From JLCFA

- Catalog cards, cross-section recognition, connection hardware, transparent profiles, and assembly-level BOM presentation are useful reference patterns.
- Machining and connection components should be visible in context but organized so dense joints remain understandable.
- The project structure is an important customer verification surface, not merely an internal scene graph.

## 16. Implementation map

- `components/DIYDesigner.tsx`: scene state, Three.js rendering, selection, transform gestures, snapping, drilling, tapping, accessories, pricing estimate, file actions, and cart conversion.
- `utils/profileMachining.ts`: canonical face/opposite-face rules and display-groove ↔ physical-groove conversion.
- `utils/productionXlsx.ts`: real XLSX creation and workbook import.
- `components/ProfileVisualizer.tsx`: storefront/production profile machining visualization.
- `components/FactorySheet.tsx`: customer/factory summaries, machining details, colors, accessory image mapping, and PDF-facing content.
- `constants.ts`: profile variants, colors, prices, weights, localized labels, and marine-board natural-color mapping.
- `public/images/accessory/*.svg`: designer-only accessory artwork/geometry references.
- `public/images/accessory/*.jpg`: physical-product references for storefront/cart/PDF/factory output; preserve them.

## 17. Regression acceptance checklist

Before releasing a designer change, verify at minimum:

### Scene and input

- Empty designer renders on desktop and mobile.
- Add each of: one profile, aluminum plate, IKEA pegboard, marine board, and every visible accessory.
- Select crowded adjacent profiles correctly and deselect by clicking empty canvas.
- Free drag works without opening a numeric dialog.
- Each axis arrow opens the correct numeric movement UI immediately and closes correctly.
- Both black end handles resize a profile; exact length entry works.
- Shift-click and Shift-marquee show all selected items visibly.
- Delete/right-click delete, duplicate, undo, redo, and Frame all work.

### Rotation and snapping

- Rotate four times around each colored axis and compare with the starting transform.
- Self-rotate a profile and verify the visible slot/covered face changes.
- Verify the in-scene rotation toolbar appears for a selected unlocked item and that the persistent right-click hint is visible.
- Test snapping for parallel, perpendicular, vertical, horizontal, and camera-oblique arrangements.
- Test 2020↔2020, 2020↔2040 on both wide-face slots, and multi-slot↔multi-slot.
- Verify snap acquisition at Frame-all zoom, stable hold near a candidate, easy separation, and no solid penetration in the proposed snap.
- Intentionally move and rotate profiles into interference: the transform must remain applied, every involved profile/tree node must turn red, and the warning must clear after separation.

### Machining

- Place through, countersunk, and threaded holes on A/B/C/D.
- Verify entry and opposite exit are visible and the countersink is larger only on entry.
- Verify two-slot B1 maps to D2 physically and exports consistently.
- Verify end tapping options and every port on 2040/multi-port variants and 2047.
- Toggle transparency and machining marks; inspect a crowded joint from multiple angles.
- Auto-fill screws and verify type, natural color, embedded head, linked hole, and penetration direction.
- Change auto-filled screw quantities manually, add the design to cart, and verify the PDF reminder plus compact grouped rows use the edited quantities without adding the legacy per-hole fee or repeating one card per screw.

### Persistence and commerce

- JSON save → load preserves the full editable assembly.
- XLSX export is recognized as a real workbook; XLSX import reconstructs parts and estimate.
- Cart and factory/PDF output preserve remarks, colors, marine “原色”, machining, tapping, accessory specifications, and JPG image mapping.
- `npm run build` passes. Treat bundle-size warnings as performance work, not a functional failure.

## 18. Known risks and next priorities

1. Verify every profile cross-section against production CAD/section drawings, especially 2020R, 3030R, 2020-N4-RD, and 2047.
2. Expand automated tests for screen-space snapping, hysteresis, collision, 360-degree rotation, and dense-scene selection.
3. Introduce explicit joint entities so two profiles, their holes/taps, connector, and screws form one editable relationship rather than unrelated scene items.
4. Improve dense-joint annotation layout and transparency behavior without hiding manufacturing details.
5. Move accessory availability/pricing into a single authoritative catalog shared with the storefront and server.
6. Add server-side price validation and eventually account/cloud design storage while retaining local JSON portability.
7. Generate canonical customer/factory 2D A/B/C/D drawings from the same physical machining model.
8. Design and validate the STEP/STP quote/import pipeline before adding STEP export.
9. Reduce the large Three.js designer bundle through deliberate code splitting after behavior stabilizes.
10. Build an AI-native design command layer on the same editable scene schema: natural-language prompts produce constrained scene operations, the designer renders the result, and a human reviews it before cart/order conversion.

## 19. Local development and version safety

- Install: `npm install`.
- Run: `npm run dev -- --port 3000`.
- Designer: `http://127.0.0.1:3000/#/diy-designer`.
- Build: `npm run build`.
- Avoid leaving servers on 3001/3002/3003; keep the active local experience on port 3000.
- The initial designer feature was merged into `main` at commit `aaad4fe448de5c1b3af9fbc57047f4a06cf1685f`.
- Pre-merge main is preserved as `backup/main-before-3d-designer-20260801` at `c578814be24ea97ed975df51c9c045116835e92e`.
- `feature/3d-diy-designer` remains as a historical feature branch.

## 20. Maintaining this knowledge

- Update this document in the same change whenever a product rule, machining convention, compatibility matrix, or export contract changes.
- Add a dated note below for decisions that reverse an earlier rule.
- Do not record passwords, tokens, customer personal data, or temporary local-machine state here.
- When implementation and this document diverge, create an explicit issue/backlog entry and state which behavior is currently shipping.

### Decision log

- **2026-08-10:** Refined compact profile BOM grouping from literal A/B/C/D labels to proven manufacturing equivalence under rotation around the profile's own length axis. The complete profile must overlap after one permitted roll, including every hole face, opposite exit, physical groove, position, hole/thread/fastener type, end tapping, and miter state. Initially only verified ordinary square open profiles `1515`, `2020`, `3030`, and `4040` permit 90° increments; this makes ordinary 2020 A→C and C→A through-hole instructions equivalent. Covered/rounded/asymmetric sections, multi-slot faces, rectangular profiles including 2040, multi-port tapping, and mitered profiles remain orientation-sensitive until an explicit symmetry and slot/port mapping is verified. When equivalence cannot be proven, rows must not be merged.
- **2026-08-10:** Corrected the Chinese product name from “宜家书法特柜子” to “宜家舒法特柜子” across storefront, configurator, generated production remarks, catalog documentation, and admin order labels. Stable internal identifiers such as `calligraphy_cabinet` remain unchanged, and backend classification continues recognizing the former Chinese spelling so historical orders remain compatible.
- **2026-08-10:** Separated fitted 3D screw shaft length from the order SKU. The former 27/28mm values were calculated geometry lengths and are retained only as `renderedScrewLengthMm`; 20-series cart/PDF rows now use the confirmed catalog specifications cylinder-head M6×30 and button-head M6×20 (flat-head M6×8 where explicitly requested). The PDF screw-type cell includes the full thread×length specification.
- **2026-08-10:** Parameterized furniture entry points open the generated 3D designer in a new browser tab/window. The calligraphy-cabinet or wardrobe product configuration page must remain open with the customer's entered dimensions, because the full-screen designer has no in-app route back to that product configurator. The same-origin template handoff remains local and one-time; it is consumed by the new designer tab without navigating the source page.
- **2026-08-10:** Corrected No.9 three-way connector placement semantics. It must attach only to a true three-profile node: three compatible profiles with mutually perpendicular length axes and endpoints converging at one corner. Its position is derived from all three end faces (with a common-endpoint fallback for legacy scenes), its local +X/-Y/+Z ports are oriented toward the three profiles, and the locked attachment records all three profile IDs. No.9 must never reuse an arbitrary two-profile joint candidate; previously saved two-profile No.9 locks are migrated to the nearest valid three-way node when possible or unlocked for review.
- **2026-08-10:** Extended compact BOM grouping to profiles. The designer project summary and customer/factory PDF may show one row for multiple profiles only when the complete physical manufacturing signature matches: product/model, length, finish/color, unit price and label service, every hole's face/position/type/thread/physical groove/fastener override, every tapping port, and both miter ends. Scene position, rotation, IDs, and generated assembly-location remarks do not split an otherwise identical manufacturing row; distinct location remarks are retained in the derived display data, while the original editable scene/cart and production JSON/XLSX remain per-profile and unchanged. Any physical machining difference must create a separate row.
- **2026-08-10:** Unified identical-accessory BOM grouping across the designer project tree and customer/factory PDF. Profiles and boards remain individually listed when their manufacturing or dimensional identity matters; shelf supports, screws, connectors, feet, and future accessory kinds are compacted by complete purchasing specification (kind/SKU, compatible profile series, dimensions or screw head/length, color, and unit price). Scene entities and their transforms/links remain separate and editable internally. Grouped cart/PDF rows retain all positions, linked-hole references, attachment references, and distinct manufacturing remarks in structured arrays, while the visible BOM shows one row with the summed quantity. Differing location text alone must not split otherwise identical accessory rows.
- **2026-08-10:** Shortened the calligraphy-cabinet top clearance without removing a basket level. Upright holes remain 130mm, 260mm, 390mm, and so on from the bottom end, but the final hole is only 65mm from the upright top. Generated height is therefore `layers×130 + 65 + 40` mm (755mm for five layers), while the structure still contains bottom frame + `N` basket-support levels + top frame. This supersedes the provisional 820mm five-layer height, whose 130mm top clearance wasted 65mm.
- **2026-08-10:** Superseded the preceding calligraphy top-depth assumption after physical-structure clarification. A cabinet with `N` basket layers has `N+2` distinct depth levels: one bottom frame level without shelf supports, `N` intermediate basket-support levels with shelf supports, and one top frame level without shelf supports, directly under the marine board and coplanar with the top continuous rails. Therefore a five-layer cabinet has seven depth levels, and generated height is `(layers+1)×130 + 40` mm (820mm for five layers); the previous 690mm height only left room for four intermediate basket levels. Top and bottom frame depth rails are both retained and must not be treated as basket supports.
- **2026-08-10:** Removed the calligraphy-cabinet top-rail interference. On each divider line, the highest 420mm basket-support profile also serves as the one and only top depth tie; the template must not generate a second nearly overlapping top depth profile. Separate 420mm bottom depth ties remain. Because the top continuous front/rear rails no longer terminate an additional depth profile, their obsolete side-face countersunk holes and linked screws are also omitted; their through holes for the uprights remain.
- **2026-08-10:** Corrected the calligraphy-cabinet vertical machining datum: the first shelf/basket suspension hole is 130mm from the bottom end of each upright, never half-pitch at 65mm. Subsequent holes and their aligned depth support rails are 260mm, 390mm, 520mm, and so on in exact 130mm increments, so the lowest 100mm basket clears the bottom frame.
- **2026-08-10:** Refined furniture fastener semantics. Every aluminum profile generated by the calligraphy-cabinet and wardrobe templates now defaults to both-end tapping, and every eligible through/countersunk hole is generated with a linked screw already present. Calligraphy shelf supports are slim slot-in ledges embedded 2mm into the 2020 groove and protruding 10mm, rendered as a simplified strip. The top/bottom continuous calligraphy rails carry separate through-hole records for the vertical-post connections in addition to the depth-tie holes.
- **2026-08-10:** Replaced the provisional wardrobe B/D-post-hole arrangement with the confirmed “horizontal caps vertical” joint. Each 2040 post is self-rotated so the 20mm face is outward and the 40mm face runs along the cabinet side. At the top and bottom, two perpendicular 2020 rails occupy the two 20mm halves of the 2040 end face; each 2020 carries its own countersunk connection to one 2040 tapping port. The continuous front/rear 2020 rails carry the through holes for separate flat-head M6×8 screws that enter the tapped ends of the perpendicular depth rails. `flat_socket` is a first-class screw head in designer/cart/PDF/XLSX output and uses the same unit-price rule as the existing 2020 half-round/button-head screw.
- **2026-08-10:** Revised the calligraphy-cabinet depth structure after visual review. At each 130mm basket level, every divider line now has one centered 420mm depth profile aligned directly with the front/rear upright hole centers; adjacent baskets share that rail. Interior rails receive shelf-support placeholders on both sides, while the two outer rails receive only inward-facing supports, preserving exactly two supports per basket without duplicated profiles. Every divider also receives a 420mm depth tie at the top and bottom, and the continuous front/rear top and bottom rails receive matching countersunk hole records.
- **2026-08-10:** Added parameterized furniture templates that enter the normal editable designer rather than maintaining a separate renderer. The IKEA calligraphy-basket cabinet uses 300×420×100mm basket bays, 130mm vertical pitch, fixed 460mm outside depth, all-2020 frame members, continuous full-width front/rear top and bottom rails, shared 420mm depth rails on each divider, exactly two shelf supports per basket, and one continuous 12mm marine-board top. Overall generated length is `columns×300 + (columns+1)×20`; overall height is determined by the current cabinet-dimension formula. Length/height bound mode treats both inputs strictly as maximum occupied-space limits and chooses the most columns and layers whose complete grid does not exceed either limit; it does not promise an exact made-to-input outside size. The one-piece marine-board top caps overall length at 2440mm (seven columns).
- **2026-08-11:** Confirmed shelf-support pricing by actual cut length: oxidized natural is ¥8/m, colored with a natural section is ¥10/m, and colored with a colored section is ¥12/m. The selected tier and calculated price must survive design JSON, cart/PDF grouping, production JSON, and Excel. Updated the calligraphy-cabinet bound-mode wording in all three languages to state explicitly that length and height are maximum space limits used to maximize complete basket columns/layers; actual generated dimensions may be smaller and are not an exact-fit promise.
- **2026-08-11:** The designer screw property card and project list now display the same purchasing specification returned by `getDiyScrewOrderSpec` as cart/PDF output, keyed by compatible profile series and screw head. Fitted values such as 27/28mm remain internal 3D rendering geometry only and are no longer editable or presented as the order length. For example, 2020 cylinder-head screws display M6×30 and 2020 button-head screws display M6×20; other series resolve through the same shared specification function.
- **2026-08-10:** The wardrobe template produces exactly 12 profiles from entered outside L/W/H: eight horizontal 2020 rails and four full-height 2040 posts. Horizontal rails receive both-end tapping; each 2040 post receives top/bottom countersunk holes on adjacent B/D faces. The supplied Xiaohongshu short link returned HTTP 404 during implementation, so B/D face selection is a reviewable provisional machining rule and all generated holes remain editable pending a usable screenshot/video reference.
- **2026-08-10:** Added a repository-local pre-push release mechanism. After the one-time `npm run setup:git-hooks`, every push rebuilds the frontend and atomically replaces `~/Downloads/mengkaile-dist-latest.zip`. Build or packaging failure blocks the push, ensuring the upload ZIP corresponds to the source about to be pushed.
- **2026-08-09:** Added a lightweight, multilingual startup progress screen in the critical HTML. It remains below 100% until React paints the usable application and then fades out, so slow connections receive immediate loading feedback.
- **2026-08-09:** Removed automatic 3D position/rotation text from printable remarks. Production-sheet previews with no address or zero shipping fee now display freight collect rather than ordinary prepaid courier service.
- **2026-08-08:** Corrected MayCAD `PROF20-2040` to Mengkaile ordinary `2040`. `2040-N1-40` in the chair reference is a post-import manual replacement, not an automatic source mapping. Added a maintained verified-intersection table; unknown MayCAD profiles use dimension-only fallback with an explicit review warning.
- **2026-08-09:** Expanded the deterministic MayCAD intersection map from 4 to 37 exact source codes using `maycad_mengkaile_aluminum_profile_common.scene`. Corrected 20×20 `21SP` to `2020R`, added verified cover variants, and mapped 30×30 Soft/two-face/three-face/four-face groups to `3030R`/`3030-N2`/`3030-N1`/`3030`; approved 3060/4040/4080 variants normalize to their ordinary Mengkaile models.
- **2026-08-09:** Standardized the Chinese brand name as “萌开了”. Added mandatory post-import model selection for unknown, unverified, and PDF-inferred MayCAD profiles. Clarified in the UI that the current importer supports profiles and recognized drilling only; accessory import remains under development.
- **2026-08-09:** Restricted the customer-facing MayCAD import picker to `.scene` files. Non-`.scene` selections are rejected before parsing with localized guidance; PDF reconstruction is no longer exposed through this picker.
- **2026-08-09:** Disabled all MayCAD AI execution by default. Removed the frontend PDF API method and made backend AI route registration opt-in through `ENABLE_MAYCAD_AI_IMPORT=1`; normal local and cloud deployments expose only deterministic `.scene` import and require no AI API key.
- **2026-08-08:** Unified legacy “配304螺丝” ordering with explicit 3D-designer screws. Explicit designer screw quantities now override the legacy per-hole add-on, always trigger the factory reminder, and export as compact specification-grouped PDF rows with no duplicate per-screw cards.
- **2026-08-08:** Reversed collision handling from blocking/reverting transforms to MayCAD-style non-blocking interference feedback. Movement and rotation now remain applied; involved profiles and project nodes are highlighted red until resolved. Added scene-level rotation controls and an explicit right-click rotate/delete hint.
- **2026-08-01:** Consolidated the initial 3D designer implementation and all subsequent product-review decisions into this durable project document.
