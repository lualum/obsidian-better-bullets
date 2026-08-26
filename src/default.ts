import { BetterBulletsSettings } from "./settings";

export const DEFAULT_SETTINGS: BetterBulletsSettings = {
	levelType: "hierarchy",
	bulletIndentation: "1ch",
	bulletStructure: "2ch",
	bulletTextGap: "1ch",
	disableInSourceMode: false,
	hierarchy: [
		{ symbol: "-", css: "" },
		{ symbol: "→", css: "font-size: 1.2em; \nfont-weight: bold;" },
		{ symbol: "⇒", css: "font-size: 1.4em; \nfont-weight: bold;" },
	],
	rules: [
		{
			name: "Numbered Lists",
			description:
				"Treat bullets ending with a colon as parents for numbered child lists.",
			matchMode: "full",
			styles: [
				{
					pattern: ".*:",
					css: "--bb-number-children: 1;",
				},
			],
		},
		{
			name: "Note Labels",
			description:
				"Highlight bullets that begin with Note: and italicize the following text.",
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
			description:
				"Style definition terms before a vertical bar as bold labels and italicize the definition text.",
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
			description:
				"Emphasize important bullets and hide the control marker unless the line is active.",
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
			description: "Italicize text enclosed in parentheses.",
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
			description: "Underline four-digit years wherever they appear.",
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
			description: "Italicize text enclosed in straight or curly quotes.",
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
			description:
				"Italicize example bullets that begin with the ex. prefix.",
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
