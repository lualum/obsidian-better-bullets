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
			: { symbol: "*", css: "" };

		this.plugin.settings.hierarchy[level] = newLevel;
		return newLevel;
	}

	renderLevelSettings(page: HTMLElement) {
		const container = page.createDiv("setting-group-no-border");
		const card = container.createDiv("bb-rule-card");

		const table = card.createEl("table", { cls: "bb-table" });

		const colgroup = table.createEl("colgroup");
		colgroup.createEl("col", { attr: { style: "width: 16.5%" } });
		colgroup.createEl("col", { attr: { style: "width: 16.5%" } });
		colgroup.createEl("col", { attr: { style: "width: 67%" } });

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
			this.display();
		});

		const removeBtn = btnRow.createEl("button", {
			text: "Remove last -",
			cls: "bb-btn-remove",
		});
		removeBtn.addEventListener("click", () => {
			if (this.plugin.settings.hierarchy.length === 0) return;
			this.plugin.settings.hierarchy.pop();
			void this.triggerRefresh();
			this.display();
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

		this.plugin.settings.rules.forEach((rule) => {
			this.createRuleCard(container, rule);
		});

		const btnRow = container.createDiv("bb-btn-row");

		const addBtn = btnRow.createEl("button", {
			text: "Add rule +",
			cls: "bb-btn-add",
		});
		addBtn.addEventListener("click", () => {
			this.addNewRule();
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
				this.display();
			}).open();
		});
	}

	createRuleCard(container: HTMLElement, rule: FormattingRule) {
		const card = container.createDiv("bb-rule-card");
		const header = card.createDiv("bb-rule-header");

		const titleInput = header.createEl("input", {
			type: "text",
			value: rule.name || "Rule",
			cls: "bb-rule-title",
		});
		titleInput.placeholder = "Rule name";
		titleInput.addEventListener("input", (e) => {
			rule.name = (e.target as HTMLInputElement).value;
			void this.triggerRefresh();
		});

		const deleteBtn = header.createEl("button", {
			text: "Delete",
			cls: "bb-btn-remove",
		});
		deleteBtn.addEventListener("click", () => {
			const currentIndex = this.plugin.settings.rules.indexOf(rule);
			if (currentIndex === -1) return;
			this.plugin.settings.rules.splice(currentIndex, 1);
			void this.triggerRefresh();
			this.display();
		});

		new Setting(card)
			.setName("Custom bullet symbol")
			.setDesc(
				"Overrides hierarchy symbol. Leave empty to use hierarchy symbol.",
			)
			.addText((text) => {
				text.setValue(rule.bullet || "").onChange((value) => {
					rule.bullet = value.trim() || undefined;
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
			rule.bulletCss = value.trim() || undefined;
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
						rule.matchMode = value as MatchMode;
						void this.triggerRefresh();
					});
			});

		const patternsSection = card.createDiv("bb-rule-pattern-section");
		new Setting(patternsSection)
			.setName("Patterns and styles")
			.setDesc(
				"Each pattern is a regex matched against the bullet text. The first matching pattern's CSS is applied.",
			);

		this.renderPatternsTable(patternsSection, rule);
	}

	renderPatternsTable(container: HTMLElement, rule: FormattingRule) {
		const table = container.createEl("table", {
			cls: "bb-table",
		});

		const colgroup = table.createEl("colgroup");
		colgroup.createEl("col", { attr: { style: "width: 33%" } });
		colgroup.createEl("col", { attr: { style: "width: 67%" } });

		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Regex" });
		headerRow.createEl("th", { text: "CSS" });

		const tbody = table.createEl("tbody");

		rule.styles.forEach((styleConfig) => {
			this.createPatternRow(tbody, rule, styleConfig);
		});

		const btnRow = container.createDiv("bb-btn-row");

		const addBtn = btnRow.createEl("button", {
			text: "Add pattern +",
			cls: "bb-btn-add",
		});

		addBtn.addEventListener("click", () => {
			const currentRuleIndex = this.plugin.settings.rules.indexOf(rule);
			if (currentRuleIndex === -1) return;
			this.plugin.settings.rules[currentRuleIndex]!.styles.push({
				pattern: "",
				css: "",
			});
			void this.triggerRefresh();
			this.display();
		});

		if (rule.styles.length > 1) {
			const removeBtn = btnRow.createEl("button", {
				text: "Remove last -",
				cls: "bb-btn-remove",
			});
			removeBtn.addEventListener("click", () => {
				const currentRuleIndex =
					this.plugin.settings.rules.indexOf(rule);
				if (currentRuleIndex === -1) return;
				const styles =
					this.plugin.settings.rules[currentRuleIndex]!.styles;
				if (styles.length <= 1) return;
				styles.pop();
				void this.triggerRefresh();
				this.display();
			});
		}
	}

	createPatternRow(
		tbody: HTMLElement,
		rule: FormattingRule,
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

		const validatePattern = (value: string) => {
			if (!value) {
				patternInput.removeAttribute("title");
				patternInput.classList.remove("bb-input-error");
				return;
			}
			try {
				new RegExp(value);
				patternInput.removeAttribute("title");
				patternInput.classList.remove("bb-input-error");
			} catch (e) {
				patternInput.title = `Invalid regex: ${(e as Error).message}`;
				patternInput.classList.add("bb-input-error");
			}
		};

		validatePattern(styleConfig.pattern);
		patternInput.addEventListener("input", (e) => {
			const value = (e.target as HTMLInputElement).value;
			validatePattern(value);
			styleConfig.pattern = value;
			void this.triggerRefresh();
		});

		const cssCell = row.createEl("td");
		const cssInput = cssCell.createEl("textarea");
		cssInput.value = styleConfig.css;
		cssInput.placeholder = "CSS styles…";
		cssInput.addEventListener("input", (e) => {
			styleConfig.css = (e.target as HTMLTextAreaElement).value;
			void this.triggerRefresh();
		});
	}

	addNewRule() {
		const newRule: FormattingRule = {
			name: "New Rule",
			matchMode: "full",
			styles: [{ pattern: "", css: "" }],
		};
		this.plugin.settings.rules.push(newRule);
		void this.triggerRefresh();
		this.display();
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

		const btnRow = contentEl.createDiv({
			cls: "modal-button-container",
		});

		const confirmBtn = btnRow.createEl("button", {
			text: "Reset",
			cls: "bb-btn-remove",
		});
		confirmBtn.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});

		const cancelBtn = btnRow.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}
