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

export const forceRefreshEffect = StateEffect.define<null>();

export interface BulletType {
   symbol: string;
   style?: string;
}

interface PendingDecoration {
   from: number;
   to: number;
   decoration: Decoration;
}

interface BulletInfo {
   indent: number;
   indentStr: string;
   bullet: string;
   space: string;
   text: string;
   fullText: string;
   match: RegExpMatchArray;
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
                  tr.effects.some((e) => e.is(forceRefreshEffect))
               )
            ) {
               this.decorations = this.format(update.view);
            }
         }

         private getBulletInfo(
            line: string,
            tabSize: number
         ): BulletInfo | null {
            const match = line.match(/^(\s*)([-*+])(\s)(.*)$/);
            if (!match) return null;

            const [, indentStr, bullet, space, fullText] = match;
            if (
               indentStr === undefined ||
               bullet === undefined ||
               space === undefined ||
               fullText === undefined
            ) {
               return null;
            }

            const indent = indentStr.replace(/\t/g, " ".repeat(tabSize)).length;

            return {
               indent,
               indentStr,
               bullet,
               space,
               text: fullText.trim(),
               fullText,
               match,
            };
         }

         private getIndentAt(indents: number[], index: number): number {
            return indents[index] ?? 0;
         }

         private getLevelAt(levels: number[], index: number): number {
            return levels[index] ?? 0;
         }

         format(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const lines = view.state.doc.toString().split("\n");
            const n = lines.length;
            const tabSize = view.state.tabSize || 4;

            const levels = new Array<number>(n).fill(0);
            const indents = new Array<number>(n).fill(0);

            // 1. Pre-calculate indents for all bullet lines
            for (let i = 0; i < n; i++) {
               const line = lines[i];
               if (!line) continue;

               const info = this.getBulletInfo(line, tabSize);
               if (info) {
                  indents[i] = info.indent;
                  levels[i] = 1;
               }
            }

            // 2. DP Pass: Right-to-Left
            for (let i = n - 1; i >= 0; i--) {
               const currentIndent = this.getIndentAt(indents, i);
               if (currentIndent === 0) continue;

               for (let j = i + 1; j < n; j++) {
                  const nextIndent = this.getIndentAt(indents, j);
                  if (nextIndent === 0) continue;

                  // If we find a strictly deeper indent, try to extend that sequence
                  if (nextIndent > currentIndent) {
                     const currentLevel = this.getLevelAt(levels, i);
                     const nextLevel = this.getLevelAt(levels, j);
                     levels[i] = Math.max(currentLevel, 1 + nextLevel);
                  }

                  if (nextIndent <= currentIndent) break;
               }
            }

            // 3. Second pass: Apply decorations
            let index = 0;
            for (let lineNum = 0; lineNum < n; lineNum++) {
               const line = lines[lineNum];
               if (!line) {
                  index += 1; // Account for newline
                  continue;
               }

               const info = this.getBulletInfo(line, tabSize);
               const level = this.getLevelAt(levels, lineNum);

               if (!info || level === 0) {
                  index += line.length + 1;
                  continue;
               }

               const depthLevel = level - 1;
               const bulletPos = index + info.indentStr.length;
               const pendingDecorations: PendingDecoration[] = [];

               const symbol = this.applyModifiers(
                  pendingDecorations,
                  info,
                  index,
                  depthLevel
               );

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

               index += line.length + 1;
            }

            return builder.finish();
         }

         private applyModifiers(
            decorations: PendingDecoration[],
            info: BulletInfo,
            lineStartIndex: number,
            level: number
         ): BulletType {
            const styles: string[] = [];
            let symbolChar: string;

            const bulletPos = lineStartIndex + info.indentStr.length;
            const textIndex =
               bulletPos + info.bullet.length + info.space.length;
            const text = info.text;
            const fullText = info.fullText;
            const trimOffset = fullText.indexOf(text);

            // Set base symbol and size based on level
            let fontSize: string | null = null;
            switch (level) {
               case 0:
                  symbolChar = "-";
                  break;
               case 1:
                  symbolChar = "→";
                  fontSize = `${this.plugin.settings.parentSize}em`;
                  styles.push(`font-size: ${fontSize}`);
                  break;
               default:
                  symbolChar = "⇒";
                  fontSize = `${this.plugin.settings.grandparentSize}em`;
                  styles.push(`font-size: ${fontSize}`);
                  break;
            }

            if (this.plugin.settings.boldNonLeafText && level > 0) {
               styles.push("font-weight: bold");
            }

            // Apply font size to entire line if level > 0
            if (fontSize && text.length > 0) {
               const lineStart = textIndex + trimOffset;
               const lineEnd = textIndex + trimOffset + text.length;
               const fontSizeDecoration = Decoration.mark({
                  attributes: {
                     style: `font-size: ${fontSize}; font-weight: ${
                        this.plugin.settings.boldNonLeafText && level > 0
                           ? "bold"
                           : "normal"
                     }`,
                  },
               });
               decorations.push({
                  from: lineStart,
                  to: lineEnd,
                  decoration: fontSizeDecoration,
               });
            }

            // 1. Note formatting (Note: )
            if (text.startsWith("Note: ")) {
               symbolChar = "*";

               const noteStart = textIndex + trimOffset;
               const noteEnd = noteStart + 5; // "Note:" is 5 characters
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

               const noteTextStart = noteEnd + 1; // +1 for space after "Note:"
               const noteTextEnd = textIndex + trimOffset + text.length;
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

            // 2. Definition formatting (Term | Definition)
            const pipeIndex = text.indexOf(" | ");
            if (pipeIndex !== -1) {
               if (this.plugin.settings.useDefinitionSymbol) {
                  symbolChar = "@";
               }

               // Term (before pipe): bold and highlight
               const termStart = textIndex + trimOffset;
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

               // Definition (after pipe): italics
               const defStart = termEnd + 3; // +3 for " | "
               const defEnd = textIndex + trimOffset + text.length;
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

            // 3. Important formatting (!)
            if (text.endsWith("!")) {
               symbolChar = "!";
               styles.push("font-weight: bold");
               styles.push(
                  `color: ${this.plugin.settings.exclamationTextColor}`
               );

               const importantStart = textIndex + trimOffset;
               const importantEnd = textIndex + trimOffset + text.length;
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

            // 4. Quote formatting (text in quotes)
            this.applyRegexFormatting(
               decorations,
               text,
               textIndex + trimOffset,
               /"([^"]+)"/g,
               "font-style: italic;"
            );

            // 5. Parenthesis formatting (text in parentheses)
            this.applyRegexFormatting(
               decorations,
               text,
               textIndex + trimOffset,
               /\([^)]+\)/g,
               "font-style: italic;"
            );

            // 6. Date formatting (4-digit years)
            this.applyRegexFormatting(
               decorations,
               text,
               textIndex + trimOffset,
               /\b\d{4}\b/g,
               "text-decoration: underline;"
            );

            // Combine all styles
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
            style: string
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
      }
   );
}
