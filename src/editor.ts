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
	style?: string;
}

interface PendingDecoration {
	from: number;
	to: number;
	decoration: Decoration;
}

interface Line {
	indent: number;
	level: number;
	spaces: number;
	bullet: string;
	text: string;
}

export function bulletReplacementPlugin(plugin: BetterBulletsPlugin) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			plugin: BetterBulletsPlugin;

			constructor(view: EditorView) {
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
				const builder = new RangeSetBuilder<Decoration>();
				const rawLines = view.state.doc.toString().split("\n");

				const lines = this.getBulletInfo(rawLines, view.state.tabSize);
				this.analyzeFold(-1, lines);

				let index = 0;
				for (let lineNum = 0; lineNum < rawLines.length; lineNum++) {
					const raw = rawLines[lineNum] ?? "";
					const line = lines[lineNum] ?? {
						indent: 0,
						level: 0,
						spaces: 0,
						bullet: "",
						text: "",
					};

					const pendingDecorations: PendingDecoration[] = [];
					if (!line.bullet) {
						index += raw.length + 1;
						continue;
					}

					const symbol = this.applyModifiers(
						pendingDecorations,
						line,
						index,
					);

					const bulletPos = index + line.indent + line.spaces;
					const bulletDecoration = Decoration.replace({
						widget: new BulletWidget(this.plugin.settings, symbol),
					});

					pendingDecorations.push({
						from: bulletPos,
						to: bulletPos + 1,
						decoration: bulletDecoration,
					});

					pendingDecorations.sort((a, b) => a.from - b.from);
					for (const { from, to, decoration } of pendingDecorations) {
						builder.add(from, to, decoration);
					}

					index += raw.length + 1;
				}

				return builder.finish();
			}

			private getBulletInfo(lines: string[], tabSize: number): Line[] {
				const result: Line[] = [];

				for (const line of lines) {
					const match = line.match(/^(\t*)(\s*)([-*+])(\s)(.*)$/);

					if (match) {
						// Valid bullet format: has bullet character AND space AND text
						const [, indents, spaces, bulletChar, , text] = match;
						const totalSpaces =
							indents!.length * tabSize + spaces!.length;

						result.push({
							indent: Math.floor(totalSpaces / tabSize),
							level: 0,
							spaces: totalSpaces % tabSize,
							bullet: bulletChar!,
							text: text ?? "",
						});
					} else {
						// No valid bullet - treat entire line as text
						const indentMatch = line.match(/^(\t*)(.*)$/);
						const [, indents, text] = indentMatch!;

						result.push({
							indent: indents!.length,
							level: 0,
							spaces: 0,
							bullet: "",
							text: text ?? "",
						});
					}
				}

				return result;
			}

			private analyzeFold(
				index: number,
				lines: Line[],
			): {
				end: number;
				level: number;
			} {
				let currentLine = index + 1;
				let level = 0;

				if (index === -1) {
					while (currentLine < lines.length) {
						const fold = this.analyzeFold(currentLine, lines);
						currentLine = fold.end;
					}
					return { end: lines.length, level: 0 };
				}

				if (!lines[index]) return { end: currentLine, level };

				while (
					currentLine < lines.length &&
					lines[index].indent < lines[currentLine]!.indent
				) {
					if (
						!lines[currentLine]!.bullet &&
						!lines[currentLine]!.text.trim()
					) {
						currentLine++;
						continue;
					}

					const fold = this.analyzeFold(currentLine, lines);
					currentLine = fold.end;
					level = Math.max(level, fold.level + 1);
				}

				lines[index].level = level;
				return { end: currentLine, level };
			}

			private applyModifiers(
				decorations: PendingDecoration[],
				info: Line,
				lineStartIndex: number,
			): BulletType {
				const styles: string[] = [];
				let symbolChar: string;

				const bulletPos = lineStartIndex + info.indent;
				const textIndex =
					bulletPos + info.bullet.length + info.spaces + 1; // +1 for space
				const text = info.text;

				const bulletConfig =
					this.plugin.settings.bulletTypes[info.level] ||
					this.plugin.settings.bulletTypes[
						this.plugin.settings.bulletTypes.length - 1
					]!;

				symbolChar = bulletConfig.symbol;
				const fontSize = bulletConfig.fontSize;
				const cssClasses = bulletConfig.cssClasses;

				if (fontSize !== 1.0) {
					styles.push(`font-size: ${fontSize}em`);
				}

				if (cssClasses) {
					if (cssClasses.includes("bold")) {
						styles.push("font-weight: bold");
					}
					if (cssClasses.includes("italic")) {
						styles.push("font-style: italic");
					}
					if (cssClasses.includes("underline")) {
						styles.push("text-decoration: underline");
					}
				}

				if (fontSize !== 1.0 && text.length > 0) {
					const lineStart = textIndex;
					const lineEnd = textIndex + text.length;

					const lineStyles = [`font-size: ${fontSize}em`];
					if (cssClasses.includes("bold")) {
						lineStyles.push("font-weight: bold");
					}
					if (cssClasses.includes("italic")) {
						lineStyles.push("font-style: italic");
					}
					if (cssClasses.includes("underline")) {
						lineStyles.push("text-decoration: underline");
					}

					const fontSizeDecoration = Decoration.mark({
						attributes: {
							style: lineStyles.join("; "),
						},
					});
					decorations.push({
						from: lineStart,
						to: lineEnd,
						decoration: fontSizeDecoration,
					});
				}

				if (text.startsWith("Note: ")) {
					symbolChar = "*";

					const noteStart = textIndex;
					const noteEnd = noteStart + 5;
					const boldDecoration = Decoration.mark({
						attributes: {
							style: "font-weight: bold; font-style: italic;",
						},
					});
					decorations.push({
						from: noteStart,
						to: noteEnd,
						decoration: boldDecoration,
					});

					const noteTextStart = noteEnd + 1;
					const noteTextEnd = textIndex + text.length;
					if (noteTextStart < noteTextEnd) {
						const italicDecoration = Decoration.mark({
							attributes: { style: "font-style: italic;" },
						});
						decorations.push({
							from: noteTextStart,
							to: noteTextEnd,
							decoration: italicDecoration,
						});
					}
				}

				const pipeIndex = text.indexOf(" | ");
				if (pipeIndex !== -1) {
					if (this.plugin.settings.useDefinitionSymbol) {
						symbolChar = "@";
					}

					const termStart = textIndex;
					const termEnd = termStart + pipeIndex;

					if (termStart < termEnd) {
						const boldDecoration = Decoration.mark({
							attributes: {
								style: "font-weight: bold; background-color: var(--text-highlight-bg);",
							},
						});
						decorations.push({
							from: termStart,
							to: termEnd,
							decoration: boldDecoration,
						});
					}

					const defStart = termEnd + 3;
					const defEnd = textIndex + text.length;
					if (defStart < defEnd) {
						const italicDecoration = Decoration.mark({
							attributes: { style: "font-style: italic;" },
						});
						decorations.push({
							from: defStart,
							to: defEnd,
							decoration: italicDecoration,
						});
					}
				}

				if (text.endsWith("!")) {
					symbolChar = "!";
					styles.push("font-weight: bold");
					styles.push(
						`color: ${this.plugin.settings.exclamationTextColor}`,
					);

					const importantStart = textIndex;
					const importantEnd = textIndex + text.length;
					if (importantStart < importantEnd) {
						const boldDecoration = Decoration.mark({
							attributes: {
								style: `font-weight: bold; color: ${this.plugin.settings.exclamationTextColor};`,
							},
						});
						decorations.push({
							from: importantStart,
							to: importantEnd,
							decoration: boldDecoration,
						});
					}
				}

				this.applyRegexFormatting(
					decorations,
					text,
					textIndex,
					/"([^"]+)"/g,
					"font-style: italic;",
				);

				this.applyRegexFormatting(
					decorations,
					text,
					textIndex,
					/\([^)]+\)/g,
					"font-style: italic;",
				);

				this.applyRegexFormatting(
					decorations,
					text,
					textIndex,
					/\b\d{4}\b/g,
					"text-decoration: underline;",
				);

				const symbol: BulletType = {
					symbol: symbolChar,
					...(styles.length > 0 && { style: styles.join("; ") }),
				};

				return symbol;
			}

			private applyRegexFormatting(
				decorations: PendingDecoration[],
				text: string,
				baseIndex: number,
				regex: RegExp,
				style: string,
			): void {
				let match: RegExpExecArray | null;
				while ((match = regex.exec(text)) !== null) {
					const matchText = match[0];
					if (!matchText) continue;

					const matchStart = baseIndex + match.index;
					const matchEnd = matchStart + matchText.length;

					if (matchStart < matchEnd) {
						const decoration = Decoration.mark({
							attributes: { style },
						});
						decorations.push({
							from: matchStart,
							to: matchEnd,
							decoration,
						});
					}
				}
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);
}
