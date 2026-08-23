<img src="docs/better-bullets-banner.png" alt="Better Bullets">

# Better Bullets for Obsidian

Better Bullets is an Obsidian plugin that enhances the **visual hierarchy and readability** of your bullet points. It uses dynamic analysis to determine the depth of your lists and applies unique symbols, font sizes, and contextual formatting based on the content of your notes.

## Features

### 1. Hierarchical Bullet Symbols

<div align="center">
  <img src="docs/hierarchy.png" alt="Hierarchical bullet symbols" width="30%">
  <div><em>Bullet symbols and sizing change automatically based on nesting depth.</em></div>
</div>
<br>

The plugin automatically changes bullet symbols based on their relationship to other items in the list:

- **Grandparent (Level 2+):** Uses the `=>` symbol.
- **Parent (Level 1):** Uses the `->` symbol.
- **Leaf (Level 0):** Uses the standard `-` symbol.

Unordered lists using `-`, `*`, or `+` and ordered lists using markers like `1.` or `1)` are supported. Ordered lists keep their source marker by default, while formatting rules can still override the displayed marker.

The default `Colon Parents Number Children` rule matches parent bullets ending in `:` and renders their immediate child bullets as a numbered list starting at `1.`. The numbering applies only one nesting level deeper, so grandchildren keep their normal markers unless their own parent matches a numbering rule.

### 2. Dynamic Text Formatting

<div align="center">
  <img src="docs/rule.png" alt="Dynamic Text Formatting examples" width="50%">
  <div><em>Formatting rules in action: term/definition, importance, quotes, and year auto-marking.</em></div>
</div>
<br>

Text is formatted based on its position in a list and specific syntax within the line:

- **Automatic Sizing:** "Parent" and "Grandparent" lines are scaled up based on your settings to create a clear visual outline.
- **Non-Leaf Bolding:** High-level list items can be automatically bolded to act as section headers.
- **Notes:** Lines starting with `Note:` use a `*` bullet, with "Note:" bolded and highlighted and the remainder italicized.
- **Definitions:** Using the `Term | Definition` syntax bolds and highlights the term and italicizes the definition.
- **Important Lines:** Lines ending with `!` are bolded and colored. The trailing `!` is hidden using the `--bb-control` property (see below).
- **Examples:** Lines starting with `ex. ` italicize the text that follows.
- **Parentheses:** Text inside `(parentheses)` is italicized anywhere in the line.
- **Years:** 4-digit numbers (e.g., `1745`) are automatically underlined anywhere in the line.
- **Quotes:** Text inside `"straight"` or `"curly"` quotes is italicized anywhere in the line.

> **Control characters:** The `--bb-control: 1` CSS property is a special signal used internally by Better Bullets. When applied to a matched pattern segment, that segment is hidden from the rendered output while remaining present in the Markdown source. This lets syntax markers (like the trailing `!` on important lines) act as triggers without appearing in the final note.

> **Numbered children:** The `--bb-number-children: 1` CSS property is another rule signal. When a matched parent bullet sets this property, its immediate child bullets render as a numbered list.

> **Bullet state flags:** Rendered bullet markers include classes and CSS custom properties for list state: `.bb-bullet--ordered`, `.bb-bullet--unordered`, `.bb-bullet--parent`, `.bb-bullet--leaf`, `--bb-ordered-list: 1`, and `--bb-parent-bullet: 1`. These can be targeted from custom snippets or combined with rule CSS to distinguish parent bullets and ordered list markers.

### 3. Settings

#### Hierarchy Configuration

<div align="center">
  <img src="docs/hierarchy_setting.png" alt="Hierarchy Setting" width="90%">
  <div>Hierarchy Configuration: Defines styles for each level.</div>
</div>
<br>

Define the bullet symbol and CSS for each indentation level. Add or remove levels as needed using the **Add level +** and **Remove last -** buttons.

#### Bullet Structure

Use the **Bullet structure** settings block to edit the three target widths used for bullet spacing:

- **Bullet indentation** — the target width between the bullet area's left side and the bullet.
- **Bullet structure** — the target content width of the bullet-only container, excluding indentation and text gap.
- **Bullet text gap** — the target width between the bullet-only container and the bullet text.

#### Formatting Rules

<div align="center">
  <img src="docs/rule_setting.png" alt="Rule Setting" width="90%">
  <div>Rule Configuration: Uses regex to make custom formatting rules.</div>
</div>
<br>

Create custom rules that match bullet text using regex patterns and apply CSS styles. Each rule supports:

- **Custom bullet symbol** — overrides the hierarchy symbol for matched bullets.
- **Custom bullet CSS** — overrides the hierarchy CSS for matched bullet symbols.
- **CSS rule signals** — use `--bb-control: 1` to hide matched source markers or `--bb-number-children: 1` to number immediate child bullets of matching parent bullets.
- **Match mode** — either _Match full line_ (pattern must match the entire text) or _Match all_ (CSS is applied if the pattern matches anywhere in the text).
- **Patterns and styles** — one or more regex/CSS pairs; the first matching pattern's styles are applied.

Rules can be added, deleted, and reordered. Clicking **Reset to defaults** will prompt a confirmation dialog before overwriting all rules with the plugin defaults.

### Hotkeys

**Move to previous/next line with same indentation**: moves to previous/next bullet that has the same indentation while being in parent's fold. Typically bound to `⌘+⌥+↑` and `⌘+⌥+↓`

## Installation

1. Download latest release, unzip, and drag to the `.obsidian/plugins` folder.
2. Enable the plugin in settings.
3. Start typing bullet points using `-`, `*`, `+`, `1.`, or `1)`.

## License

This project is open source under the terms of the MIT License — see the [LICENSE](https://github.com/lualum/obsidian-better-bullets/blob/main/LICENSE) file for details.
