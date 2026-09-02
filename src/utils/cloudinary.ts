/**
 * Cloudinary responsive-image helpers.
 *
 * Shared by `CloudinaryPicture.astro`, the `rehype-cloudinary-picture`
 * plugin, and (mirrored) the breakpoint upload script. All delivery is
 * plain Cloudinary URL-based transformations — no Sharp, no astro:assets.
 *
 * URL anatomy:
 *   https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<public_id>
 * where <transforms> is a comma-joined string such as
 *   c_fill,ar_16:9,g_auto,w_800,q_auto,f_jxl
 *
 * Recorded breakpoint widths live in `src/data/cloudinary-breakpoints.json`
 * and are produced by `pnpm cloudinary:breakpoints -- <image-path>`.
 * See `docs/RESPONSIVE-IMAGES.md` for the full workflow.
 */

import breakpointsData from "../data/cloudinary-breakpoints.json";

export type CloudinaryFormat = "jxl" | "avif" | "webp";

/** Delivery order matters: best compression first, most compatible last. */
export const FORMATS: CloudinaryFormat[] = ["jxl", "avif", "webp"];

export const MIME_TYPES: Record<CloudinaryFormat, string> = {
	jxl: "image/jxl",
	avif: "image/avif",
	webp: "image/webp",
};

/** Fallback srcset widths when an image has no recorded breakpoints. */
export const DEFAULT_WIDTHS = [400, 800, 1200, 1600, 2000];

export interface ArtDirectionDevice {
	minWidth: number;
	vw: number;
	aspectRatio: string;
}

const breakpointMap = breakpointsData as Record<string, number[]>;

/**
 * Cloud name resolution order:
 *  1. Vite-injected `import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME`
 *     (the client-safe variable components use).
 *  2. `process.env` — covers the astro.config / rehype-plugin context,
 *     where a Vite injection may not exist yet.
 */
export function getCloudName(): string | undefined {
	try {
		const viteEnv = import.meta.env?.PUBLIC_CLOUDINARY_CLOUD_NAME;
		if (viteEnv) return viteEnv;
	} catch {
		// import.meta.env may be undefined in a plain Node context.
	}
	// Read through globalThis so this file type-checks without @types/node
	// in the component (browser-facing) scope.
	const proc = (
		globalThis as { process?: { env?: Record<string, string | undefined> } }
	).process;
	if (proc?.env) {
		return (
			proc.env.PUBLIC_CLOUDINARY_CLOUD_NAME ||
			proc.env.CLOUDINARY_CLOUD_NAME ||
			undefined
		);
	}
	return undefined;
}

/**
 * Map an image reference to a Cloudinary public ID.
 *
 * Accepts:
 *   - "assets/blog/cover"            (bare public ID, used as-is)
 *   - "/assets/blog/cover.jpg"       (site-absolute path to public/)
 *   - "public/assets/blog/cover.jpg" / "src/assets/x.png"
 *
 * Returns null for anything that should NOT go through Cloudinary:
 * external URLs, data URIs, SVG (vector — no benefit), and GIF
 * (animation; format conversion would freeze it).
 */
export function toPublicId(src: string | undefined | null): string | null {
	if (!src || typeof src !== "string") return null;
	const trimmed = src.trim();
	if (
		trimmed.includes("://") ||
		trimmed.startsWith("//") ||
		trimmed.startsWith("data:")
	) {
		return null;
	}
	const lower = trimmed.toLowerCase();
	if (lower.endsWith(".svg") || lower.endsWith(".gif")) return null;

	let path = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
	if (path.startsWith("public/")) path = path.slice("public/".length);
	else if (path.startsWith("src/")) path = path.slice("src/".length);

	// Drop only a real file extension (a dot after the last slash).
	// "assets/blog/cover.jpg" -> "assets/blog/cover"
	// "assets/blog/cover"     -> "assets/blog/cover" (already an ID)
	const lastDot = path.lastIndexOf(".");
	const lastSlash = path.lastIndexOf("/");
	if (lastDot > lastSlash) path = path.slice(0, lastDot);

	return path || null;
}

/**
 * Widths for the srcset of one image. Uses the breakpoints recorded by the
 * upload script when available, otherwise DEFAULT_WIDTHS. When the intrinsic
 * width is known, never advertise a width above it (upscaling wastes bytes).
 */
export function getWidths(publicId: string, intrinsicWidth?: number): number[] {
	const recorded = breakpointMap[publicId];
	const widths =
		recorded && recorded.length > 0 ? [...recorded] : [...DEFAULT_WIDTHS];

	if (intrinsicWidth && Number.isFinite(intrinsicWidth) && intrinsicWidth > 0) {
		const capped = widths.filter((w) => w < intrinsicWidth);
		capped.push(intrinsicWidth);
		if (capped.length > 1) return capped;
	}
	return widths;
}

export interface UrlOptions {
	format: CloudinaryFormat;
	width?: number;
	/** "16:9" etc. — switches to a c_fill crop with gravity auto. Omit/empty/"original" for no crop. */
	aspectRatio?: string;
	quality?: string;
}

/** Build one Cloudinary delivery URL. */
export function cloudinaryUrl(
	publicId: string,
	{ format, width, aspectRatio, quality = "auto" }: UrlOptions,
): string {
	const cloudName = getCloudName();
	const transforms: string[] = [];
	if (aspectRatio && aspectRatio !== "original") {
		transforms.push("c_fill", `ar_${aspectRatio}`, "g_auto");
	}
	if (width) transforms.push(`w_${width}`);
	transforms.push(`q_${quality}`, `f_${format}`);
	return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(
		",",
	)}/${publicId}`;
}

/** "url 400w, url 800w, …" for one format. */
export function buildSrcSet(
	publicId: string,
	format: CloudinaryFormat,
	widths: number[],
	aspectRatio?: string,
): string {
	return widths
		.map(
			(w) =>
				`${cloudinaryUrl(publicId, { format, width: w, aspectRatio })} ${w}w`,
		)
		.join(", ");
}

/**
 * Parse the compact art-direction string produced by the upload script:
 * "1200|40|original,992|60|16:9,768|70|4:3,0|100|1:1"
 * Each segment is "minWidth|viewportPercent|aspectRatio".
 */
export function parseDevices(input: string): ArtDirectionDevice[] {
	return input
		.split(",")
		.map((part) => {
			const seg = part.trim().split("|");
			return {
				minWidth: Number(seg[0]),
				vw: Number(seg[1]),
				aspectRatio: (seg[2] ?? "").trim() || "original",
			};
		})
		.filter(
			(d) =>
				Number.isFinite(d.minWidth) &&
				d.minWidth >= 0 &&
				Number.isFinite(d.vw) &&
				d.vw > 0,
		);
}

/** sizes attribute derived from a device set ("(min-width: 768px) 70vw, 100vw"). */
export function buildDeviceSizes(devices: ArtDirectionDevice[]): string {
	const sorted = [...devices].sort((a, b) => a.minWidth - b.minWidth);
	const smallest = sorted[0];
	const rest = sorted.slice(1).sort((a, b) => b.minWidth - a.minWidth);
	const clauses = rest.map((d) => `(min-width: ${d.minWidth}px) ${d.vw}vw`);
	return [...clauses, `${smallest.vw}vw`].join(", ");
}
