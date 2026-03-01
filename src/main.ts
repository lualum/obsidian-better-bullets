import type { EditorView } from "@codemirror/view";
import { bulletReplacementPlugin, moveToSameIndent } from "editor";
import { Editor, MarkdownView, Plugin } from "obsidian";
import { BetterBulletsSettings, BetterBulletsSettingTab } from "./settings";
import { DEFAULT_SETTINGS } from "default";

export default class BetterBulletsPlugin extends Plugin {
	settings: BetterBulletsSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension([bulletReplacementPlugin(this)]);
		this.addSettingTab(new BetterBulletsSettingTab(this.app, this));
		this.addCommand({
			id: "move-to-same-indent-up",
			name: "Move to previous line with same indentation",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const cm = (editor as unknown as { cm: EditorView }).cm;
				if (cm) moveToSameIndent(cm, -1);
			},
		});

		this.addCommand({
			id: "move-to-same-indent-down",
			name: "Move to next line with same indentation",
			editorCallback: (editor: Editor, view: MarkdownView) => {
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
