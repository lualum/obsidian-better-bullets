import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import type BetterBulletsPlugin from "./main";
import { BulletWidget } from "./widget";

export const reloadEffect = StateEffect.define<boolean>();

export interface BulletType {
	symbol: string;
	style: string;
}

interface PendingDecoration {
	from: number;
	to: number;
	decoration: Decoration;
}

interface LineInfo {
	indent: number;
	spaces: number;
	bullet: string;
	text: string;
	index: number;
}

class BetterBulletsViewPlugin {
	plugin: BetterBulletsPlugin;
	decorations: DecorationSet;

	constructor(view: EditorView, plugin: BetterBulletsPlugin) {
		this.plugin = plugin;
		this.decorations = this.format(view);
	}

	update(update: ViewUpdate) {
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
		const doc = view.state.doc;
		const builder = new RangeSetBuilder<Decoration>();
		const pendingDecorations: PendingDecoration[] = [];

		const getLineInfo = (lineIdx: number): LineInfo => {
			if (lineIdx < 1 || lineIdx > doc.lines)
				throw new Error("Line number out of bounds!");

			const line = doc.line(lineIdx);
			const raw = line.text;
			const tabSize = view.state.tabSize;
			const match = raw.match(/^(\t*)(\s*)([-*+])(\s)(.*)$/);

			if (match) {
				const [, indents, spaces, bullet, , text] = match;
				const totalSpaces = indents!.length * tabSize + spaces!.length;

				return {
					indent: Math.floor(totalSpaces / tabSize),
					spaces: totalSpaces % tabSize,
					bullet: bullet!,
					text: text ?? "",
					index: line.from,
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
				text: indentMatch[2] ?? "",
				index: line.from,
			};
		};

		const applyModifiers = (
			info: LineInfo,
			isBullet: boolean,
			level: number,
		) => {
			if (!isBullet) return;
			const bulletIdx = info.index + info.indent + info.spaces;
			const textIdx = bulletIdx + info.bullet.length + 1;
			const text = info.text;
			const bulletSettings =
				this.plugin.settings.hierarchy[level] ??
				this.plugin.settings.hierarchy.at(-1);
			if (!bulletSettings) return;
			let symbol = bulletSettings.symbol;
			let bulletCss = bulletSettings.css;
			for (const rule of this.plugin.settings.rules) {
				const matchMode = rule.matchMode;
				if (matchMode === "full") {
					const regex = new RegExp(
						`^(${rule.styles.map((s) => s?.pattern).join(")(")})$`,
					);
					const groups = text.match(regex);
					if (!groups) continue;
					if (rule.bullet) {
						symbol = rule.bullet;
					}
					if (rule.bulletCss) {
						bulletCss = rule.bulletCss;
					}
					let groupIdx = textIdx;
					for (let i = 0; i < rule.styles.length; i++) {
						const ruleSettings = rule.styles[i];
						const groupText = groups[i + 1];
						if (groupText === undefined) break;
						if (!ruleSettings || !ruleSettings.css) {
							groupIdx += groupText.length;
							continue;
						}
						const textDecoration = Decoration.mark({
							attributes: { style: ruleSettings.css },
						});
						pendingDecorations.push({
							from: groupIdx,
							to: groupIdx + groupText.length,
							decoration: textDecoration,
						});
						groupIdx += groupText.length;
					}
				} else {
					let anyMatched = false;
					for (const ruleSettings of rule.styles) {
						if (!ruleSettings?.pattern) continue;
						for (const match of text.matchAll(
							new RegExp(ruleSettings.pattern, "g"),
						)) {
							anyMatched = true;
							if (!ruleSettings.css) continue;
							const textDecoration = Decoration.mark({
								attributes: { style: ruleSettings.css },
							});
							pendingDecorations.push({
								from: textIdx + match.index,
								to: textIdx + match.index + match[0].length,
								decoration: textDecoration,
							});
						}
					}
					if (anyMatched) {
						if (rule.bullet) {
							symbol = rule.bullet;
						}
						if (rule.bulletCss) {
							bulletCss = rule.bulletCss;
						}
					}
				}
			}
			const css = bulletSettings.css;
			if (css && text.length > 0) {
				const textDecoration = Decoration.mark({
					attributes: {
						style: css,
					},
				});
				pendingDecorations.push({
					from: textIdx,
					to: textIdx + text.length,
					decoration: textDecoration,
				});
			}
			const bulletDecoration = Decoration.replace({
				widget: new BulletWidget(this.plugin.settings, {
					symbol: symbol,
					style: bulletCss,
				}),
			});
			pendingDecorations.push({
				from: bulletIdx,
				to: bulletIdx + 1,
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

				const fold = analyzeFold(currLine, isBullet, info.indent);

				applyModifiers(info, isBullet, fold.level);

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
