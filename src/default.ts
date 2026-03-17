import { BetterBulletsSettings } from "settings";

export const DEFAULT_SETTINGS: BetterBulletsSettings = {
	hierarchy: [
		{ symbol: "-", css: "" },
		{ symbol: "→", css: "font-size: 1.2em; \nfont-weight: bold;" },
		{ symbol: "⇒", css: "font-size: 1.4em; \nfont-weight: bold;" },
	],
	rules: [
		{
			name: "Note Labels",
			matchMode: "full",
			styles: [
				{
					pattern: "Note:",
					css: "font-weight: bold; \nbackground-color: var(--text-highlight-bg);",
				},
				{
					pattern: " .*",
					css: "font-style: italic;",
				},
			],
			bullet: "*",
		},
		{
			name: "Definitions",
			matchMode: "full",
			styles: [
				{
					pattern: "[^|]*",
					css: "font-weight: bold; \nbackground-color: var(--text-highlight-bg);",
				},
				{
					pattern: " \\| ",
					css: "",
				},
				{
					pattern: ".*",
					css: "font-style: italic;",
				},
			],
			bullet: "",
		},
		{
			name: "Important Label",
			matchMode: "full",
			styles: [
				{
					pattern: ".*",
					css: "font-weight: bold; \ncolor: var(--text-sub-accent);",
				},
				{
					pattern: "!",
					css: "font-weight: bold; \ncolor: color-mix(in srgb, var(--text-sub-accent) 50%, transparent);\n--bb-control: 1;",
				},
			],
			bulletCss: "font-weight: bold; \ncolor: var(--text-sub-accent);",
		},
		{
			name: "Parenthetical Text",
			matchMode: "any",
			styles: [
				{
					pattern: "\\(([^)]+)\\)",
					css: "font-style: italic;",
				},
			],
		},
		{
			name: "Years",
			matchMode: "any",
			styles: [
				{
					pattern: "\\b(\\d{4})\\b",
					css: "text-decoration: underline;",
				},
			],
		},
		{
			name: "Quotes",
			matchMode: "any",
			styles: [
				{
					pattern: '[\u201c"]([^\u201d"]*)["\\u201d]',
					css: "font-style: italic;",
				},
			],
		},
		{
			name: "Examples",
			matchMode: "full",
			styles: [
				{
					pattern: "ex. ",
					css: "",
				},
				{
					pattern: ".*",
					css: "font-style: italic;",
				},
			],
		},
	],
};
