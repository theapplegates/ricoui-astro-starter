const SITE_URL = import.meta.env.PUBLIC_SITE_URL || "https://ricoui-astro-starter.vercel.app";

export const siteConfig = {
	title: "Paul Applegate — Post-Quantum Cryptography",
	author: "Paul Applegate",
	url: SITE_URL,
	utm: {
		source: SITE_URL,
		medium: "referral",
		campaign: "navigation",
	},
	meta: {
		title: "Paul Applegate · PQC Engineer & Open Source Developer",
		description:
			"Post-quantum cryptography research, Rust systems programming, OpenPGP implementations, and open-source contributions from Charleston, SC.",
		keywords:
			"post-quantum cryptography, PQC, SLH-DSA, Dilithium, XMSSMT, Sequoia-PGP, Rust, open source, cryptography",
		image: `${SITE_URL}/assets/preview.jpg`,
		twitterHandle: "",
	},
	social: {
		github: "https://github.com/theapplegates",
	},
};
