const SITE_URL = import.meta.env.PUBLIC_SITE_URL || "https://ricoui-astro-starter.vercel.app";

export const siteConfig = {
	title: "Paul Applegate — License to Blog",
	author: "Paul Applegate",
	url: SITE_URL,
	utm: {
		source: SITE_URL,
		medium: "referral",
		campaign: "navigation",
	},
	meta: {
		title: "Paul Applegate · License to Blog",
		description:
			"Dossiers on Bond films, martinis, and other classified matters — shaken, not stirred, from Charleston, SC.",
		keywords:
			"James Bond, 007, Bond films, film blog, mission log, Bond girls, villains, gadgets, Charleston",
		image: `${SITE_URL}/assets/preview.jpg`,
		twitterHandle: "",
	},
	social: {
		github: "https://github.com/theapplegates",
	},
};
