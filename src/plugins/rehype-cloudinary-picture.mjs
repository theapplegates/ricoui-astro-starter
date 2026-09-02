/**
 * rehype plugin: rewrite markdown images into responsive Cloudinary
 * <picture> markup at build time.
 *
 * `![alt](/assets/blog/cover.jpg)` becomes
 *   <picture class="responsive-picture">
 *     <source type="image/jxl"  srcset="…" sizes="…">
 *     <source type="image/avif" srcset="…" sizes="…">
 *     <source type="image/webp" srcset="…" sizes="…">
 *     <img …(original tag, src swapped to the Cloudinary WebP URL)>
 *   </picture>
 *
 * Skipped (left as plain <img>):
 *   - external URLs, data URIs, SVG, GIF (see toPublicId)
 *   - every image when PUBLIC_CLOUDINARY_CLOUD_NAME is not configured
 *
 * Registered in astro.config.mjs under markdown.rehypePlugins so both
 * Markdown and MDX content get the rewrite. Docs: docs/RESPONSIVE-IMAGES.md
 */

import {
	FORMATS,
	MIME_TYPES,
	buildSrcSet,
	cloudinaryUrl,
	getCloudName,
	getWidths,
	toPublicId,
} from "../utils/cloudinary.ts";

/** Article-body default: matches --inner-screen (800px) in global.css. */
const DEFAULT_SIZES = "(min-width: 840px) 800px, 100vw";

function sourceNode(format, publicId, widths) {
	return {
		type: "element",
		tagName: "source",
		properties: {
			type: MIME_TYPES[format],
			srcSet: buildSrcSet(publicId, format, widths),
			sizes: DEFAULT_SIZES,
		},
		children: [],
	};
}

function toPicture(img) {
	const props = img.properties ?? {};
	const src = typeof props.src === "string" ? props.src : null;
	const publicId = src ? toPublicId(src) : null;
	if (!publicId) return null;

	const width =
		typeof props.width === "number" && Number.isFinite(props.width)
			? props.width
			: undefined;
	const widths = getWidths(publicId, width);

	// Fallback <img>: reuse the original node, swap in the Cloudinary WebP
	// URL, and default lazy/async attributes without overriding authors.
	const fallback = {
		type: "element",
		tagName: "img",
		properties: {
			...props,
			src: cloudinaryUrl(publicId, { format: "webp", width }),
			loading: props.loading ?? "lazy",
			decoding: props.decoding ?? "async",
		},
		children: [],
	};

	return {
		type: "element",
		tagName: "picture",
		properties: { className: ["responsive-picture"] },
		children: [
			...FORMATS.map((format) => sourceNode(format, publicId, widths)),
			fallback,
		],
	};
}

/** Depth-first walk, replacing <img> elements in place. */
function visit(node, enabled) {
	if (!node.children) return;
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (child.type === "element" && child.tagName === "img") {
			if (enabled) {
				const picture = toPicture(child);
				if (picture) node.children[i] = picture;
			}
			continue; // no img children to recurse into
		}
		visit(child, enabled);
	}
}

export default function rehypeCloudinaryPicture() {
	return (tree) => visit(tree, Boolean(getCloudName()));
}
