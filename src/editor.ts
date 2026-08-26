import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import type BetterBulletsPlugin from "./main";
import type { FormattingRule } from "./settings";
import { BulletWidget } from "./widget";

export const reloadEffect = StateEffect.define<boolean>();

export interface BulletType {
	symbol: string;
	style: string;
	isOrdered: boolean;
	isParent: boolean;
}

interface PendingDecoration {
	from: number;
	to: number;
	decoration: Decoration;
}

interface TextStyleSpan {
	from: number;
	to: number;
	css: string;
	order: number;
}

interface LineInfo {
	indent: number;
	spaces: number;
	bullet: string;
	marker: string;
	text: string;
	index: number;
	bulletIdx: number;
	textIdx: number;
	isOrdered: boolean;
}

function getIndentLevel(lineText: string, tabSize: number): number {
	const match = lineText.match(/^(\t*)(\s*)/);
	if (!match) return 0;
	const tabs = match[1]!.length;
	const spaces = match[2]!.length;
	return Math.floor((tabs * tabSize + spaces) / tabSize);
}

function combineCss(...cssBlocks: (string | undefined)[]): string {
	const span = createSpan();
	span.style.cssText = cssBlocks.filter(Boolean).join("; ");
	return span.style.cssText;
}

function hasCssFlag(css: string, property: string): boolean {
	const span = createSpan();
	span.style.cssText = css;
	return span.style.getPropertyValue(property).trim() !== "";
}

function getFullRuleMatch(
	rule: FormattingRule,
	text: string,
): RegExpMatchArray | null {
	let regex: RegExp;
	try {
		regex = new RegExp(
			`^(${rule.styles.map((s) => s?.pattern).join(")(")})$`,
		);
	} catch {
		return null;
	}

	return text.match(regex);
}

function doesRuleSetCssFlag(
	rule: FormattingRule,
	text: string,
	property: string,
): boolean {
	if (rule.matchMode === "full") {
		const groups = getFullRuleMatch(rule, text);
		if (!groups) return false;

		for (let i = 0; i < rule.styles.length; i++) {
			const ruleSettings = rule.styles[i];
			const groupText = groups[i + 1];
			if (groupText === undefined) break;
			if (ruleSettings && hasCssFlag(ruleSettings.css, property)) {
				return true;
			}
		}

		return false;
	}

	for (const ruleSettings of rule.styles) {
		if (!ruleSettings?.pattern) continue;
		let compiledRegex: RegExp;
		try {
			compiledRegex = new RegExp(ruleSettings.pattern, "g");
		} catch {
			continue;
		}
		if (
			compiledRegex.test(text) &&
			hasCssFlag(ruleSettings.css, property)
		) {
			return true;
		}
	}

	return false;
}

export function moveToSameIndent(view: EditorView, direction: 1 | -1): boolean {
	const state = view.state;
	const doc = state.doc;
	const tabSize = state.tabSize;

	const cursorPos = state.selection.main.head;
	const cursorLine = doc.lineAt(cursorPos);
	const currentIndent = getIndentLevel(cursorLine.text, tabSize);

	let lineNum = doc.lineAt(cursorPos).number + direction;

	while (lineNum >= 1 && lineNum <= doc.lines) {
		const line = doc.line(lineNum);

		if (line.text.trim() === "") {
			lineNum += direction;
			continue;
		}

		const lineIndent = getIndentLevel(line.text, tabSize);

		if (lineIndent === currentIndent) {
			view.dispatch({
				selection: { anchor: line.to, head: line.to },
				scrollIntoView: true,
			});
			return true;
		}

		if (lineIndent < currentIndent) {
			break;
		}

		lineNum += direction;
	}

	return false;
}

class BetterBulletsViewPlugin {
	plugin: BetterBulletsPlugin;
	decorations: DecorationSet;

	constructor(view: EditorView, plugin: BetterBulletsPlugin) {
		this.plugin = plugin;
		this.decorations = this.format(view);
	}

	update(update: ViewUpdate) {
		// Disable rendering in Source mode (Live Preview only).
		if (!update.state.field(editorLivePreviewField)) {
			this.decorations = Decoration.none;
			return;
		}

		if (
			update.docChanged ||
			update.viewportChanged ||
			update.selectionSet ||
			update.transactions.some((tr) =>
				tr.effects.some((e) => e.is(reloadEffect)),
			)
		) {
			this.decorations = this.format(update.view);
		}
	}

	format(view: EditorView): DecorationSet {
		// Disable rendering in Source mode (Live Preview only).
		if (!view.state.field(editorLivePreviewField)) {
			return Decoration.none;
		}

		const doc = view.state.doc;
		const builder = new RangeSetBuilder<Decoration>();
		const pendingDecorations: PendingDecoration[] = [];

		const getLineInfo = (lineIdx: number): LineInfo => {
			if (lineIdx < 1 || lineIdx > doc.lines)
				throw new Error("Line number out of bounds!");

			const line = doc.line(lineIdx);
			const raw = line.text;
			const tabSize = view.state.tabSize;
			const match = raw.match(
				/^(\t*)(\s*)((?:[-*+])|(?:\d{1,9}[.)]))(\s+)(.*)$/,
			);

			if (match) {
				const [, indents, spaces, marker, markerSpace, text] = match;
				const totalSpaces = indents!.length * tabSize + spaces!.length;
				const bulletIdx =
					line.from + indents!.length + spaces!.length;

				return {
					indent: Math.floor(totalSpaces / tabSize),
					spaces: totalSpaces % tabSize,
					bullet: marker!,
					marker: marker!,
					text: text ?? "",
					index: line.from,
					bulletIdx,
					textIdx:
						bulletIdx + marker!.length + markerSpace!.length,
					isOrdered: /^\d{1,9}[.)]$/.test(marker!),
				};
			}

			const indentMatch = raw.match(/^(\t*)(.*)$/);
			if (!indentMatch) {
				throw new Error("Could not parse line!");
			}

			return {
				indent: indentMatch[1]!.length,
				spaces: 0,
				bullet: "",
				marker: "",
				text: indentMatch[2] ?? "",
				index: line.from,
				bulletIdx: -1,
				textIdx: -1,
				isOrdered: false,
			};
		};

		const applyModifiers = (
			info: LineInfo,
			isBullet: boolean,
			level: number,
			indentLevel: number,
			orderedMarker?: string,
		) => {
			if (!isBullet) return;

			const bulletIdx = info.bulletIdx;
			const textIdx = info.textIdx;
			const text = info.text;

			const hierarchyIndex =
				this.plugin.settings.levelType === "indent"
					? indentLevel
					: level;
			const bulletSettings =
				this.plugin.settings.hierarchy[hierarchyIndex] ??
				this.plugin.settings.hierarchy[
					this.plugin.settings.hierarchy.length - 1
				];

			if (!bulletSettings) return;

			const displayAsOrdered = info.isOrdered || orderedMarker !== undefined;
			let symbol =
				orderedMarker ??
				(info.isOrdered ? info.marker : bulletSettings.symbol);
			let bulletCss = bulletSettings.css;

			const textStyleSpans: TextStyleSpan[] = [];
			let styleOrder = 0;

			const addTextStyleSpan = (from: number, to: number, css: string) => {
				if (!css || from >= to) return;
				textStyleSpans.push({
					from,
					to,
					css,
					order: styleOrder++,
				});
			};

			for (const rule of this.plugin.settings.rules) {
				const matchMode = rule.matchMode;
				if (matchMode === "full") {
					const groups = getFullRuleMatch(rule, text);
					if (!groups) continue;
					if (rule.bullet) {
						symbol = rule.bullet;
					}
					if (rule.bulletCss) {
						bulletCss = combineCss(bulletSettings.css, rule.bulletCss);
					}
					let groupIdx = textIdx;
					for (let i = 0; i < rule.styles.length; i++) {
						const ruleSettings = rule.styles[i];
						const groupText = groups[i + 1];
						if (groupText === undefined) break;
						if (!ruleSettings) {
							groupIdx += groupText.length;
							continue;
						}
						addTextStyleSpan(
							groupIdx,
							groupIdx + groupText.length,
							ruleSettings.css,
						);
						groupIdx += groupText.length;
					}
				} else {
					let anyMatched = false;
					for (const ruleSettings of rule.styles) {
						if (!ruleSettings?.pattern) continue;
						let compiledRegex: RegExp;
						try {
							compiledRegex = new RegExp(
								ruleSettings.pattern,
								"g",
							);
						} catch {
							continue;
						}
						let match: RegExpExecArray | null;
						while ((match = compiledRegex.exec(text)) !== null) {
							anyMatched = true;
							addTextStyleSpan(
								textIdx + match.index,
								textIdx + match.index + match[0].length,
								ruleSettings.css,
							);
							if (match[0].length === 0) {
								compiledRegex.lastIndex++;
							}
						}
					}
					if (anyMatched) {
						if (rule.bullet) {
							symbol = rule.bullet;
						}
						if (rule.bulletCss) {
							bulletCss = combineCss(bulletSettings.css, rule.bulletCss);
						}
					}
				}
			}

			const lineStart = textIdx;
			const lineEnd = textIdx + text.length;
			const boundaries = new Set<number>([lineStart, lineEnd]);
			for (const span of textStyleSpans) {
				boundaries.add(Math.max(lineStart, span.from));
				boundaries.add(Math.min(lineEnd, span.to));
			}
			const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

			for (let i = 0; i < sortedBoundaries.length - 1; i++) {
				const from = sortedBoundaries[i]!;
				const to = sortedBoundaries[i + 1]!;
				if (from >= to) continue;

				const matchingSpans = textStyleSpans
					.filter((span) => span.from < to && span.to > from)
					.sort((a, b) => a.order - b.order);
				const css = combineCss(
					bulletSettings.css,
					...matchingSpans.map((span) => span.css),
				);
				if (css) {
					pendingDecorations.push({
						from,
						to,
						decoration: Decoration.mark({
							attributes: { style: css },
						}),
					});
				}
			}

			const bulletDecoration = Decoration.replace({
				widget: new BulletWidget(this.plugin.settings, {
					symbol: symbol,
					style: bulletCss,
					isOrdered: displayAsOrdered,
					isParent: level > 0,
				}),
			});
			pendingDecorations.push({
				from: bulletIdx,
				to: textIdx,
				decoration: bulletDecoration,
			});
		};

		const analyzeFold = (
			lineNum: number,
			asBullet: boolean,
			indent: number,
		): { end: number; level: number } => {
			let level = 0;
			let currLine = lineNum + 1;
			const parentInfo = lineNum > 0 ? getLineInfo(lineNum) : null;
			const numberImmediateChildren =
				asBullet &&
				parentInfo !== null &&
				this.plugin.settings.rules.some(
					(rule) =>
						doesRuleSetCssFlag(
							rule,
							parentInfo.text,
							"--bb-number-children",
						),
				);
			let childNumber = 1;

			while (currLine <= doc.lines) {
				const info = getLineInfo(currLine);
				if (!info) break;

				if (!info.bullet && !info.text) {
					currLine++;
					continue;
				}

				if (indent >= info.indent) break;

				const isBullet =
					asBullet &&
					info.bullet !== "" &&
					indent + 1 === info.indent;
				const orderedMarker =
					isBullet && numberImmediateChildren
						? `${childNumber++}.`
						: undefined;

				const fold = analyzeFold(currLine, isBullet, info.indent);

				applyModifiers(
					info,
					isBullet,
					fold.level,
					info.indent,
					orderedMarker,
				);

				currLine = fold.end;
				level = Math.max(level, fold.level + 1);
			}

			return {
				end: currLine,
				level,
			};
		};

		analyzeFold(0, true, -1);

		pendingDecorations
			.sort((a, b) => a.from - b.from)
			.forEach((d) => builder.add(d.from, d.to, d.decoration));

		return builder.finish();
	}
}

export function bulletReplacementPlugin(plugin: BetterBulletsPlugin) {
	return ViewPlugin.fromClass(
		class extends BetterBulletsViewPlugin {
			constructor(view: EditorView) {
				super(view, plugin);
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);
}
