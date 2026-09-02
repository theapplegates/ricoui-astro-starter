# Responsive Images with Cloudinary (JXL / AVIF / WebP)

Sep 1, 2026 at 8:41 PM
This site delivers responsive images through **Cloudinary** instead of
Sharp / `astro:assets`. Cloudinary is the only piece in the stack that can
emit **JXL**, and it also handles AVIF and WebP resizing on the CDN, so no
local image processing happens at build time.

`sharp` is still installed (Astro's default image service expects it) but is
**intentionally unused** — all new responsive images go through Cloudinary.

## The moving parts

```
scripts/cloudinary-breakpoints.mjs   (one-time, per image)
        │  uploads image, records optimal widths
        ▼
src/data/cloudinary-breakpoints.json (keyed by public ID)
        ▲                    ▲
        │ read at build      │ read at build
src/components/ui/CloudinaryPicture.astro     src/plugins/rehype-cloudinary-picture.mjs
        │                                          │
        └────── both emit ─────────────────────────┘
        <picture>
          <source type="image/jxl"  srcset="… 400w, … 800w, …" sizes="…">
          <source type="image/avif" srcset="…" sizes="…">
          <source type="image/webp" srcset="…" sizes="…">
          <img src="…f_webp…" alt loading="lazy" decoding="async">
        </picture>
```

| Piece | Location | Runs when |
| --- | --- | --- |
| URL/width helpers | `src/utils/cloudinary.ts` | build time |
| `<picture>` component | `src/components/ui/CloudinaryPicture.astro` | build time |
| Markdown image rewriter | `src/plugins/rehype-cloudinary-picture.mjs` (registered in `astro.config.mjs` → `markdown.rehypePlugins`, inherited by MDX) | build time |
| Upload + breakpoint recorder | `scripts/cloudinary-breakpoints.mjs` (`pnpm cloudinary:breakpoints -- <file>`) | manual, per image |
| Recorded widths | `src/data/cloudinary-breakpoints.json` | written by the script |

## Why the source order is JXL → AVIF → WebP

The browser picks the **first** `<source>` whose `type` it supports:

1. **JXL** (`f_jxl`) — best compression. Safari 17+, Chrome behind a flag.
2. **AVIF** (`f_avif`) — catches every other modern browser.
3. **WebP** (`f_webp`) — universal safety net, also the `<img>` fallback for
   browsers that don't understand `<picture>`.

## URL anatomy

```
https://res.cloudinary.com/<cloud-name>/image/upload/<transforms>/<public-id>
transforms  = c_fill,ar_16:9,g_auto,w_800,q_auto,f_avif
public-id   = assets/blog/cover       (no extension; f_* sets the format)
```

`/assets/blog/cover.jpg` in frontmatter maps to public ID `assets/blog/cover`
(strip leading `/`, `public/` or `src/`, drop the extension). The same mapping
is used by the upload script, so paths and Cloudinary stay in sync.

## Environment variables

```env
PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name   # site build (safe to expose)
CLOUDINARY_CLOUD_NAME=your-cloud-name          # upload script only
CLOUDINARY_API_KEY=...                         # upload script only
CLOUDINARY_API_SECRET=...                      # upload script only — never PUBLIC_
```

**If `PUBLIC_CLOUDINARY_CLOUD_NAME` is empty, everything degrades to plain
`<img>` tags** pointing at the local paths — you can develop offline or before
anything is uploaded to Cloudinary.

## Recipes

### Add a new image (blog cover, content image, …)

```bash
pnpm cloudinary:breakpoints -- public/assets/blog/my-cover.jpg
```

The script uploads the file as `assets/blog/my-cover`, asks Cloudinary for
optimal breakpoint widths, merges them into
`src/data/cloudinary-breakpoints.json`, and prints a paste-ready
`<CloudinaryPicture ... />` snippet (with real intrinsic `width`/`height`).

Then either:

- **Markdown/MDX body** — just write `![Alt text](/assets/blog/my-cover.jpg)`.
  The rehype plugin rewrites it automatically.
- **Frontmatter `img:` fields** (blog cards) — unchanged; `BlogCard` already
  routes them through `CloudinaryPicture`.
- **Astro components** — use the printed snippet, with
  `import CloudinaryPicture from "@/components/ui/CloudinaryPicture.astro";`

No upload yet? It still builds — the component falls back to default widths
`[400, 800, 1200, 1600, 2000]`, and if the cloud name is missing entirely it
falls back to a plain `<img>`.

### Art direction (different crops per device)

Pass `devices` — compact `minWidth|viewportPercent|aspectRatio` segments,
largest first:

```astro
<CloudinaryPicture
  src="assets/blog/my-cover"
  alt="Bond on a rooftop"
  width={1600}
  height={900}
  devices="1200|40|original,992|60|16:9,768|70|4:3,0|100|1:1"
/>
```

Each row adds `<source media="(min-width: Npx)">` sets with a `c_fill` crop;
the `0|` row is the phone fallback and also shapes the final `<img>`.
The upload script can generate this string interactively (press Enter at the
device prompt to include all presets).

### Override widths ad hoc

`breakpoints="400, 800, 1200"` on the component overrides the recorded JSON.

## Gotchas

- **alt is required** — `CloudinaryPicture` throws at build time on an empty
  alt. The upload snippet ships with `alt="TODO: describe this image"`;
  replace it before publishing.
- **SVG and GIF never go through Cloudinary** — vector needs no raster
  pipeline and format conversion would freeze animation; they render as plain
  `<img>`.
- **External URLs** are passed through untouched.
- **Each new transformation URL costs Cloudinary credits** — the free plan's
  monthly credit allowance covers typical blog traffic, but watch usage if you
  add many breakpoints/art-direction crops.
- **Intrinsic cap** — if `width` is provided, the srcset never advertises a
  width above the real image; no upscaling.
- The `<picture>` wrapper uses `display: contents` (`.responsive-picture` in
  `global.css`) so image classes like `w-full h-full object-cover` on cards
  and the article borders/shadows keep working unchanged.

## Verifying

1. `pnpm build`, then check `dist/blog/index.html` for `res.cloudinary.com`
   and `image/jxl` + `image/avif` + `image/webp` sources.
2. Browser devtools → Network: Chrome/FF request AVIF/WebP; Safari 17+ can
   serve JXL. JXL-only browsers are rare — that's expected; it sits first for
   the browsers that do support it.
