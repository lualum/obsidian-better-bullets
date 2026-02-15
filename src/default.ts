import { BetterBulletsSettings } from "settings";

export const DEFAULT_SETTINGS: BetterBulletsSettings = {
	hierarchy: [
		{ symbol: "-", css: "" },
		{ symbol: "->", css: "font-size: 1.2em; \nfont-weight: bold;" },
		{ symbol: "=>", css: "font-size: 1.4em; \nfont-weight: bold;" },
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
					pattern: ".*",
					css: "font-weight: bold; \nbackground-color: var(--text-highlight-bg);",
				},
				{
					pattern: " \\| ",
					css: "font-weight: bold;",
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
					pattern: ".*!",
					css: "font-weight: bold; \ncolor: var(--text-sub-accent);",
				},
			],
			bullet: "!",
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
	],
};
