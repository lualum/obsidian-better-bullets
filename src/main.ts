import type { EditorView } from "@codemirror/view";
import { bulletReplacementPlugin, moveToSameIndent } from "./editor";
import { Editor, MarkdownView, Plugin } from "obsidian";
import type { PluginSettingTab } from "obsidian";
import { BetterBulletsSettings, BetterBulletsSettingTab } from "./settings";
import { DEFAULT_SETTINGS } from "./default";

const OLD_IMPORTANT_TEXT_CSS =
	"font-weight: bold; \ncolor: var(--text-sub-accent);";
const OLD_IMPORTANT_CONTROL_CSS =
	"font-weight: bold; \ncolor: color-mix(in srgb, var(--text-sub-accent) 50%, transparent);\n--bb-control: 1;";

export default class BetterBulletsPlugin extends Plugin {
	settings: BetterBulletsSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension([bulletReplacementPlugin(this)]);
		this.addSettingTab(
			new BetterBulletsSettingTab(
				this.app,
				this,
			) as unknown as PluginSettingTab,
		);
		this.addCommand({
			id: "move-to-same-indent-up",
			name: "Move to previous line with same indentation",
			editorCallback: (editor: Editor) => {
				const cm = (editor as unknown as { cm: EditorView }).cm;
				if (cm) moveToSameIndent(cm, -1);
			},
		});

		this.addCommand({
			id: "move-to-same-indent-down",
			name: "Move to next line with same indentation",
			editorCallback: (editor: Editor) => {
				const cm = (editor as unknown as { cm: EditorView }).cm;
				if (cm) moveToSameIndent(cm, 1);
			},
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as BetterBulletsSettings,
		);
		if (this.migrateImportantLabelAccent()) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private migrateImportantLabelAccent(): boolean {
		const defaultRule = DEFAULT_SETTINGS.rules.find(
			(rule) => rule.name === "Important Label",
		);
		const savedRule = this.settings.rules.find(
			(rule) => rule.name === "Important Label",
		);
		if (!defaultRule || !savedRule) return false;

		let changed = false;
		if (savedRule.styles[0]?.css === OLD_IMPORTANT_TEXT_CSS) {
			savedRule.styles[0].css = defaultRule.styles[0]?.css ?? "";
			changed = true;
		}
		if (savedRule.styles[1]?.css === OLD_IMPORTANT_CONTROL_CSS) {
			savedRule.styles[1].css = defaultRule.styles[1]?.css ?? "";
			changed = true;
		}
		if (savedRule.bulletCss === OLD_IMPORTANT_TEXT_CSS) {
			savedRule.bulletCss = defaultRule.bulletCss;
			changed = true;
		}

		return changed;
	}

	refreshEditors() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;

			const editor = leaf.view.editor;
			if (!editor) return;

			if (!("cm" in editor)) return;
			const cm = editor.cm as EditorView;

			cm.dispatch({
				selection: cm.state.selection,
			});
		});
	}
}
