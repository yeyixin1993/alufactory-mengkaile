# Website fonts

Chinese and English UI: Noto Sans SC Variable. Japanese UI: Noto Sans JP Variable. Full variable weight range (100–900) avoids mixed device-specific bold CJK fallbacks. HTML language tracks the selected UI locale (zh-CN/en/ja). Tailwind font-sans and form controls share the same stack.

Fontsource packages are pinned in package.json/package-lock.json. Vite bundles WOFF2 unicode-range subsets on the same origin; no Google Fonts CDN dependency. Copyright notices and SIL Open Font License 1.1 are distributed in public/fonts/licenses and copied to dist/fonts/licenses. Commercial website use and embedding are permitted by OFL; retain the license files when deploying.

Sources: https://fontsource.org/fonts/noto-sans-sc/about and https://fontsource.org/fonts/noto-sans-jp/about; https://openfontlicense.org/ofl-faq/ .
