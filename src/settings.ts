import { App, Modal, PluginSettingTab, Setting } from "obsidian";
import type BetterBulletsPlugin from "./main";
import { DEFAULT_SETTINGS } from "default";

export interface BulletType {
	symbol: string;
	css: string;
}

export type MatchMode = "full" | "any";

export interface FormattingRule {
	name: string;
	matchMode: MatchMode;
	styles: {
		pattern: string;
		css: string;
	}[];
	bullet?: string;
	bulletCss?: string;
}

export interface BetterBulletsSettings {
	hierarchy: BulletType[];
	rules: FormattingRule[];
}

export class BetterBulletsSettingTab extends PluginSettingTab {
	plugin: BetterBulletsPlugin;

	constructor(app: App, plugin: BetterBulletsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl: page } = this;
		page.empty();

		new Setting(page).setName("Hierarchy configuration").setHeading();
		this.renderLevelSettings(page);

		new Setting(page).setName("Formatting rules").setHeading();
		this.renderFormattingRules(page);
	}

	getLevelStyle(level: number): BulletType {
		if (this.plugin.settings.hierarchy[level]) {
			return this.plugin.settings.hierarchy[level];
		}

		const newLevel = DEFAULT_SETTINGS.hierarchy[level]
			? { ...DEFAULT_SETTINGS.hierarchy[level] }
			: {
					symbol: "*",
					css: "",
				};

		this.plugin.settings.hierarchy[level] = newLevel;
		return newLevel;
	}

	renderLevelSettings(page: HTMLElement) {
		const container = page.createDiv("setting-group-no-border");

		const card = container.createDiv("bb-rule-card");

		const table = card.createEl("table", {
			cls: "bb-table",
		});

		const colgroup = table.createEl("colgroup");
		colgroup.createEl("col", { attr: { style: "width: 16.5%" } }); // Level
		colgroup.createEl("col", { attr: { style: "width: 16.5%" } }); // Symbol
		colgroup.createEl("col", { attr: { style: "width: 67%" } }); // CSS

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Level" });
		headerRow.createEl("th", { text: "Symbol" });
		headerRow.createEl("th", { text: "CSS" });

		const tbody = table.createEl("tbody");
		for (let i = 0; i < this.plugin.settings.hierarchy.length; i++) {
			this.createLevelRow(tbody, i);
		}

		const btnRow = card.createDiv("bb-btn-row");

		const addBtn = btnRow.createEl("button", {
			text: "Add level +",
			cls: "bb-btn-add",
		});
		addBtn.addEventListener("click", () => {
			const index = this.plugin.settings.hierarchy.length;
			const newLevel: BulletType = DEFAULT_SETTINGS.hierarchy[index]
				? { ...DEFAULT_SETTINGS.hierarchy[index] }
				: { symbol: "*", css: "" };
			this.plugin.settings.hierarchy.push(newLevel);
			void this.triggerRefresh();
			container.remove();
			this.renderLevelSettings(page);
		});

		const removeBtn = btnRow.createEl("button", {
			text: "Remove last -",
			cls: "bb-btn-remove",
		});
		removeBtn.addEventListener("click", () => {
			if (this.plugin.settings.hierarchy.length === 0) return;
			this.plugin.settings.hierarchy.pop();
			void this.triggerRefresh();
			container.remove();
			this.renderLevelSettings(page);
		});
	}

	createLevelRow(tbody: HTMLElement, index: number) {
		const level = this.getLevelStyle(index);

		const row = tbody.createEl("tr", { cls: "bb-row" });

		row.createEl("td", { text: `${index + 1}` });

		const symbolCell = row.createEl("td");
		const symbolInput = symbolCell.createEl("input", {
			type: "text",
			value: level.symbol,
		});
		symbolInput.classList.add("bb-setting-short");
		symbolInput.addEventListener("input", (e) => {
			this.getLevelStyle(index).symbol = (
				e.target as HTMLInputElement
			).value;
			void this.triggerRefresh();
		});

		const cssCell = row.createEl("td");
		const cssText = cssCell.createEl("textarea", {
			cls: "bb-css-textarea",
		});
		cssText.value = level.css ?? "";

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		cssText.placeholder = "e.g. \n\nfont-size: 1em; \ncolor: red;";
		cssText.addEventListener("input", (e) => {
			this.getLevelStyle(index).css = (
				e.target as HTMLTextAreaElement
			).value;
			void this.triggerRefresh();
		});
	}

	renderFormattingRules(page: HTMLElement) {
		const container = page.createDiv("setting-group-no-border");

		this.plugin.settings.rules.forEach((rule, index) => {
			this.createRuleCard(container, rule, index, page);
		});

		const btnRow = container.createDiv("bb-btn-row");

		const addBtn = btnRow.createEl("button", {
			text: "Add rule +",
			cls: "bb-btn-add",
		});
		addBtn.addEventListener("click", () => {
			this.addNewRule(container, page);
		});

		const resetBtn = btnRow.createEl("button", {
			text: "Reset to defaults",
			cls: "bb-btn-remove",
		});
		resetBtn.addEventListener("click", () => {
			new ConfirmResetModal(this.app, () => {
				this.plugin.settings.rules = DEFAULT_SETTINGS.rules.map(
					(r) => ({
						...r,
						styles: r.styles.map((s) => ({ ...s })),
					}),
				);
				void this.triggerRefresh();
				container.remove();
				this.renderFormattingRules(page);
			}).open();
		});
	}

	createRuleCard(
		container: HTMLElement,
		rule: FormattingRule,
		index: number,
		page: HTMLElement,
	) {
		const card = container.createDiv("bb-rule-card");

		const header = card.createDiv("bb-rule-header");

		const titleInput = header.createEl("input", {
			type: "text",
			value: rule.name || `Rule ${index + 1}`,
			cls: "bb-rule-title",
		});
		titleInput.placeholder = "Rule name";
		titleInput.addEventListener("input", (e) => {
			this.plugin.settings.rules[index]!.name = (
				e.target as HTMLInputElement
			).value;
			void this.triggerRefresh();
		});

		const deleteBtn = header.createEl("button", {
			text: "Delete",
			cls: "bb-btn-remove",
		});
		deleteBtn.addEventListener("click", () => {
			this.plugin.settings.rules.splice(index, 1);
			void this.triggerRefresh();
			container.remove();
			this.renderFormattingRules(page);
		});

		new Setting(card)
			.setName("Custom bullet symbol")
			.setDesc(
				"Overrides hierarchy symbol. Leave empty to use hierarchy symbol.",
			)
			.addText((text) => {
				text.setValue(rule.bullet || "").onChange((value) => {
					this.plugin.settings.rules[index]!.bullet =
						value.trim() || undefined;
					void this.triggerRefresh();
				});
				text.inputEl.classList.add("bb-setting-short");
			});

		const bulletCssSetting = new Setting(card)
			.setName("Custom bullet CSS")
			.setDesc(
				"Overrides hierarchy CSS. Leave empty to use hierarchy CSS.",
			);
		const bulletCssText = bulletCssSetting.controlEl.createEl("textarea", {
			cls: "bb-textarea",
		});
		bulletCssText.value = rule.bulletCss ?? "";

		// eslint-disable-next-line obsidianmd/ui/sentence-case
		bulletCssText.placeholder = "e.g. \n\nfont-size: 1em; \ncolor: red;";
		bulletCssText.addEventListener("input", (e) => {
			const value = (e.target as HTMLTextAreaElement).value;
			this.plugin.settings.rules[index]!.bulletCss =
				value.trim() || undefined;
			void this.triggerRefresh();
		});

		new Setting(card)
			.setName("Match mode")
			.setDesc(
				"Full line: the pattern must match the entire bullet text. Match all: apply CSS if any pattern matches anywhere in the text.",
			)
			.addDropdown((drop) => {
				drop.addOption("full", "Match full line")
					.addOption("any", "Match all")
					.setValue(rule.matchMode ?? "full")
					.onChange((value) => {
						this.plugin.settings.rules[index]!.matchMode =
							value as MatchMode;
						void this.triggerRefresh();
					});
			});

		const patternsSection = card.createDiv("bb-rule-pattern-section");
		new Setting(patternsSection)
			.setName("Patterns and styles")
			.setDesc(
				"Each pattern is a regex matched against the bullet text. The first matching pattern's CSS is applied.",
			);
		this.renderPatternsTable(patternsSection, rule, index, container, page);
	}

	renderPatternsTable(
		container: HTMLElement,
		rule: FormattingRule,
		ruleIndex: number,
		rulesContainer: HTMLElement,
		page: HTMLElement,
	) {
		const existing = container.querySelector("table");
		if (existing) existing.remove();
		const existingBtnRow = container.querySelector(".bb-btn-row");
		if (existingBtnRow) existingBtnRow.remove();

		const table = container.createEl("table", {
			cls: "bb-table",
		});

		const colgroup = table.createEl("colgroup");
		colgroup.createEl("col", { attr: { style: "width: 33%" } }); // Regex
		colgroup.createEl("col", { attr: { style: "width: 67%" } }); // CSS

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Regex" });
		headerRow.createEl("th", { text: "CSS" });

		const tbody = table.createEl("tbody");

		rule.styles.forEach((styleConfig, styleIndex) => {
			this.createPatternRow(tbody, ruleIndex, styleIndex, styleConfig);
		});

		const btnRow = container.createDiv("bb-btn-row");

		const addBtn = btnRow.createEl("button", {
			text: "Add pattern +",
			cls: "bb-btn-add",
		});
		addBtn.addEventListener("click", () => {
			this.plugin.settings.rules[ruleIndex]!.styles.push({
				pattern: "",
				css: "",
			});
			void this.triggerRefresh();
			rulesContainer.remove();
			this.renderFormattingRules(page);
		});

		const removeBtn = btnRow.createEl("button", {
			text: "Remove last -",
			cls: "bb-btn-remove",
		});
		removeBtn.addEventListener("click", () => {
			const styles = this.plugin.settings.rules[ruleIndex]!.styles;
			if (styles.length === 0) return;
			styles.pop();
			void this.triggerRefresh();
			rulesContainer.remove();
			this.renderFormattingRules(page);
		});
	}

	createPatternRow(
		tbody: HTMLElement,
		ruleIndex: number,
		styleIndex: number,
		styleConfig: { pattern: string; css: string },
	) {
		const row = tbody.createEl("tr", { cls: "bb-row" });

		const patternCell = row.createEl("td");
		const patternInput = patternCell.createEl("input", {
			type: "text",
			cls: "bb-rule-title",
		});
		patternInput.value = styleConfig.pattern;
		patternInput.placeholder = "Pattern…";
		patternInput.addEventListener("input", (e) => {
			this.plugin.settings.rules[ruleIndex]!.styles[styleIndex]!.pattern =
				(e.target as HTMLInputElement).value;
			void this.triggerRefresh();
		});

		const cssCell = row.createEl("td");
		const cssInput = cssCell.createEl("textarea");
		cssInput.value = styleConfig.css;
		cssInput.placeholder = "CSS styles…";
		cssInput.addEventListener("input", (e) => {
			this.plugin.settings.rules[ruleIndex]!.styles[styleIndex]!.css = (
				e.target as HTMLTextAreaElement
			).value;
			void this.triggerRefresh();
		});
	}

	addNewRule(container: HTMLElement, page: HTMLElement) {
		const newRule: FormattingRule = {
			name: "New Rule",
			matchMode: "full",
			styles: [],
		};
		this.plugin.settings.rules.push(newRule);
		void this.triggerRefresh();
		container.remove();
		this.renderFormattingRules(page);
	}

	async triggerRefresh() {
		await this.plugin.saveSettings();
		this.plugin.refreshEditors();
	}
}

class ConfirmResetModal extends Modal {
	private onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Reset to defaults?" });
		contentEl.createEl("p", {
			text: "This will replace all formatting rules with the defaults. This cannot be undone.",
		});

		const btnRow = contentEl.createDiv({ cls: "modal-button-container" });

		const confirmBtn = btnRow.createEl("button", {
			text: "Reset",
			cls: "bb-btn-remove",
		});
		confirmBtn.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}
