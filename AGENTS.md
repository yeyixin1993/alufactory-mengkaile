# Repository guidance

For work involving the 3D DIY designer, profile machining, designer exports, or designer-to-cart behavior, read these files before changing code:

1. `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md` — product decisions, manufacturing semantics, interaction rules, acceptance criteria, and roadmap.
2. `DIY_DESIGNER_IMPLEMENTATION.md` — implementation overview and basic local run instructions.

Treat the source code and catalog data as the authority for what is currently implemented. Treat the project-knowledge document as the authority for intended product behavior. If they disagree, call out the mismatch instead of silently choosing one.

When a product decision changes, update `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md` in the same change. Preserve existing physical-product JPG images; designer-only SVG geometry must not replace them. Run `npm run build` after relevant frontend changes. Use port 3000 for local designer testing and avoid starting unnecessary additional dev-server ports.

