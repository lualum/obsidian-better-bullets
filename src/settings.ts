import { App, Modal, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import type BetterBulletsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./default";

interface DeclarativeSettingTabBase {
	app: App;
	containerEl: HTMLElement;
	hide(): void;
	update?: () => void;
}

const DeclarativePluginSettingTab = PluginSettingTab as unknown as new (
	app: App,
	plugin: BetterBulletsPlugin,
) => DeclarativeSettingTabBase;

const cssPlaceholder = "e.g. \n\nfont-size: 1em; \ncolor: red;";

export interface BulletType {
	symbol: string;
	css: string;
}

export type LevelType = "hierarchy" | "indent";
export type MatchMode = "full" | "any";

export interface FormattingRule {
	name: string;
	description?: string;
	matchMode: MatchMode;
	styles: {
		pattern: string;
		css: string;
	}[];
	bullet?: string;
	bulletCss?: string;
}

export interface BetterBulletsSettings {
	levelType: LevelType;
	bulletIndentation: string;
	bulletStructure: string;
	bulletTextGap: string;
	enableInSourceMode: boolean;
	hierarchy: BulletType[];
	rules: FormattingRule[];
}

type SettingDefinition =
	| SettingDefinitionGroup
	| SettingDefinitionList
	| SettingDefinitionPage
	| SettingDefinitionItem;

interface SettingDefinitionItem {
	name: string;
	desc?: string;
	searchable?: boolean;
	render?: (setting: Setting, index: number) => void | (() => void);
	action?: (index: number) => void;
}

interface SettingDefinitionGroup {
	type: "group";
	heading: string;
	items: SettingDefinition[];
}

interface SettingDefinitionList {
	type: "list";
	heading: string;
	emptyState?: string;
	addItem?: {
		name: string;
		action: () => void;
	};
	onDelete?: (index: number) => void;
	items: SettingDefinitionItem[];
}

interface SettingDefinitionPage {
	type: "page";
	name: string;
	desc?: string;
	items: SettingDefinition[];
}

export class BetterBulletsSettingTab extends DeclarativePluginSettingTab {
	plugin: BetterBulletsPlugin;

	private openRuleIndices: Set<number> = new Set();

	constructor(app: App, plugin: BetterBulletsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinition[] {
		return [
			{
				type: "group",
				heading: "Hierarchy configuration",
				items: [
					{
						name: "Level type",
						desc: "Changes how levels are defined. Defined as levels of children under it or indentation.",
						render: (setting) => this.renderLevelTypeSetting(setting),
					},
					{
						name: "Add level",
						action: () => this.addLevel(),
					},
					...this.plugin.settings.hierarchy.map((_, index) => ({
						type: "page" as const,
						name: `Level ${index + 1}`,
						items: this.getLevelSettingDefinitions(index),
					})),
				],
			},
			{
				type: "group",
				heading: "Bullet structure",
				items: [
					{
						name: "Bullet indentation",
						desc: "Target width between the bullet area's left side and the bullet.",
						render: (setting) =>
							this.renderBulletIndentationSetting(setting),
					},
					{
						name: "Bullet structure",
						desc: "Target content width of the bullet-only container, excluding indentation and text gap.",
						render: (setting) =>
							this.renderBulletStructureSetting(setting),
					},
{
						name: "Bullet text gap",
						desc: "Target width between the bullet-only container and text.",
						render: (setting) =>
							this.renderBulletTextGapSetting(setting),
					},
					{
						name: "Enable in source mode",
						desc: "Enable bullet rendering when the editor is in source mode.",
						render: (setting) =>
							this.renderEnableInSourceModeSetting(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Formatting rules",
				items: [
					{
						name: "Add rule",
						action: () => this.addNewRule(),
					},
					{
						name: "Reset to defaults",
						action: () => this.confirmResetRules(),
					},
					...this.plugin.settings.rules.map((rule, index) => ({
						type: "page" as const,
						name: rule.name || `Rule ${index + 1}`,
						desc:
							rule.description ||
							"Regex patterns, CSS, and bullet overrides.",
						items: this.getRuleSettingDefinitions(rule, index),
					})),
				],
			},
		];
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

	private renderLevelTypeSetting(setting: Setting) {
		setting
			.setName("Level type")
			.setDesc(
				"Changes how levels are defined. Defined as levels of children under it or indentation.",
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("hierarchy", "Hierarchy")
					.addOption("indent", "Indentation");
				dropdown.setValue(this.plugin.settings.levelType);
				dropdown.onChange((value) => {
					this.plugin.settings.levelType = value as LevelType;
					void this.triggerRefresh();
				});
			});
	}

	renderLevelSettings(page: HTMLElement) {
		const container = page.createDiv("bb-settings-section");

		this.renderLevelTypeSetting(new Setting(container));

		for (let i = 0; i < this.plugin.settings.hierarchy.length; i++) {
			this.createLevelSetting(container, i);
		}

		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add level")
					.setCta()
					.onClick(() => this.addLevel()),
			)
			.addButton((button) => {
				button.setButtonText("Remove last").onClick(() => {
					this.deleteLevel(this.plugin.settings.hierarchy.length - 1);
				});
				button.setDisabled(this.plugin.settings.hierarchy.length <= 1);
			});
	}

	private addLevel() {
		const index = this.plugin.settings.hierarchy.length;
		const newLevel: BulletType = DEFAULT_SETTINGS.hierarchy[index]
			? { ...DEFAULT_SETTINGS.hierarchy[index] }
			: { symbol: "*", css: "" };
		this.plugin.settings.hierarchy.push(newLevel);
		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	private deleteLevel(index: number) {
		if (this.plugin.settings.hierarchy.length <= 1) return;
		this.plugin.settings.hierarchy.splice(index, 1);
		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	createLevelSetting(container: HTMLElement, index: number) {
		this.renderLevelSetting(new Setting(container), index);
	}

	private renderLevelSetting(setting: Setting, index: number) {
		const level = this.getLevelStyle(index);

		setting
			.setName(`Level ${index + 1}`)
			.setClass("bb-level-setting")
			.addText((text) => {
				text.setPlaceholder("Symbol")
					.setValue(level.symbol)
					.onChange((value) => {
						this.getLevelStyle(index).symbol = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-setting-short");
			})
			.addTextArea((text) => {
				text.setPlaceholder(cssPlaceholder)
					.setValue(level.css ?? "")
					.onChange((value) => {
						this.getLevelStyle(index).css = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
			});
	}

	private getLevelSettingDefinitions(index: number): SettingDefinition[] {
		return [
			{
				name: "Bullet symbol",
				render: (setting) => this.renderLevelSymbolSetting(setting, index),
			},
			{
				name: "Bullet CSS",
				render: (setting) => this.renderLevelCssSetting(setting, index),
			},
			{
				name: "Delete level",
				action: () => this.deleteLevel(index),
			},
		];
	}

	private renderLevelSymbolSetting(setting: Setting, index: number) {
		const level = this.getLevelStyle(index);

		setting
			.setName("Bullet symbol")
			.setClass("bb-level-setting")
			.addText((text) => {
				text.setPlaceholder("Symbol")
					.setValue(level.symbol)
					.onChange((value) => {
						this.getLevelStyle(index).symbol = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-setting-short");
			});
	}

	private renderLevelCssSetting(setting: Setting, index: number) {
		const level = this.getLevelStyle(index);

		setting
			.setName("Bullet CSS")
			.setClass("bb-level-setting")
			.addTextArea((text) => {
				text.setPlaceholder(cssPlaceholder)
					.setValue(level.css ?? "")
					.onChange((value) => {
						this.getLevelStyle(index).css = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
			});
	}

	private renderBulletIndentationSetting(setting: Setting) {
		setting
			.setName("Bullet indentation")
			.setDesc(
				"Target width between the bullet area's left side and the bullet.",
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.bulletIndentation).onChange(
					(value) => {
						this.plugin.settings.bulletIndentation =
							value.trim() ||
							DEFAULT_SETTINGS.bulletIndentation;
						void this.triggerRefresh();
					},
				);
				text.inputEl.placeholder = DEFAULT_SETTINGS.bulletIndentation;
				text.inputEl.classList.add("bb-setting-short");
			});
	}

	private renderBulletStructureSetting(setting: Setting) {
		setting
			.setName("Bullet structure")
			.setDesc(
				"Target content width of the bullet-only container, excluding indentation and text gap.",
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.bulletStructure).onChange(
					(value) => {
						this.plugin.settings.bulletStructure =
							value.trim() || DEFAULT_SETTINGS.bulletStructure;
						void this.triggerRefresh();
					},
				);
				text.inputEl.placeholder = DEFAULT_SETTINGS.bulletStructure;
				text.inputEl.classList.add("bb-setting-short");
			});
	}

	private renderBulletTextGapSetting(setting: Setting) {
		setting
			.setName("Bullet text gap")
			.setDesc(
				"Target width between the bullet-only container and text.",
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.bulletTextGap).onChange(
					(value) => {
						this.plugin.settings.bulletTextGap =
							value.trim() || DEFAULT_SETTINGS.bulletTextGap;
						void this.triggerRefresh();
					},
				);
				text.inputEl.placeholder = DEFAULT_SETTINGS.bulletTextGap;
				text.inputEl.classList.add("bb-setting-short");
			});
	}

	private renderEnableInSourceModeSetting(setting: Setting) {
		setting
			.setName("Enable in source mode")
			.setDesc(
				"Enable bullet rendering when the editor is in source mode.",
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableInSourceMode)
					.onChange((value) => {
						this.plugin.settings.enableInSourceMode = value;
						void this.triggerRefresh();
					});
			});
	}

	renderBulletStructureSettings(page: HTMLElement) {
		const container = page.createDiv("bb-settings-section");

		this.renderBulletIndentationSetting(new Setting(container));
		this.renderBulletStructureSetting(new Setting(container));
		this.renderBulletTextGapSetting(new Setting(container));
	}

	renderFormattingRules(page: HTMLElement) {
		const container = page.createDiv("bb-settings-section");

		this.plugin.settings.rules.forEach((rule, index) => {
			this.createRuleCard(container, rule, index);
		});

		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add rule")
					.setCta()
					.onClick(() => this.addNewRule()),
			)
			.addButton((button) =>
				button.setButtonText("Reset to defaults").onClick(() => {
					this.confirmResetRules();
				}),
			);
	}

	private confirmResetRules() {
		new ConfirmResetModal(this.app, () => {
			this.plugin.settings.rules = DEFAULT_SETTINGS.rules.map((r) => ({
				...r,
				styles: r.styles.map((s) => ({ ...s })),
			}));
			this.openRuleIndices.clear();
			void this.triggerRefresh();
			this.refreshSettingsTab();
		}).open();
	}

	private getRuleSettingDefinitions(
		rule: FormattingRule,
		ruleIndex: number,
	): SettingDefinition[] {
		return [
			{
				name: "Rule name",
				render: (setting) => this.renderRuleNameSetting(setting, rule),
			},
			{
				name: "Description",
				render: (setting) =>
					this.renderRuleDescriptionSetting(setting, rule),
			},
			{
				name: "Custom bullet symbol",
				desc: "Overrides hierarchy symbol. Leave empty to use hierarchy symbol.",
				render: (setting) => this.renderRuleBulletSetting(setting, rule),
			},
			{
				name: "Custom bullet CSS",
				desc: "Overrides hierarchy CSS for the bullet symbol. Spacing is controlled by the bullet structure settings.",
				render: (setting) =>
					this.renderRuleBulletCssSetting(setting, rule),
			},
			{
				name: "Match mode",
				desc: "Full line: the pattern must match the entire bullet text. Match all: apply CSS if any pattern matches anywhere in the text.",
				render: (setting) => this.renderRuleMatchModeSetting(setting, rule),
			},
			{
				type: "list",
				heading: "Patterns and styles",
				emptyState: "No patterns configured.",
				addItem: {
					name: "Add pattern",
					action: () => this.addPattern(rule),
				},
				onDelete: (index) => this.deletePattern(rule, index),
				items: rule.styles.map((styleConfig, index) => ({
					name: `Pattern ${index + 1}`,
					desc: "Regex and CSS for this text segment.",
					render: (setting) =>
						this.renderPatternSetting(setting, styleConfig, index),
				})),
			},
			{
				name: "Delete rule",
				action: () => this.deleteRule(rule, ruleIndex),
			},
		];
	}

	createRuleCard(
		container: HTMLElement,
		rule: FormattingRule,
		ruleIndex: number,
	) {
		const isOpen = this.openRuleIndices.has(ruleIndex);
		let body!: HTMLElement;

		new SettingGroup(container)
			.setHeading(rule.name || "Rule")
			.addExtraButton((button) =>
				button
					.setIcon(isOpen ? "chevron-down" : "chevron-right")
					.setTooltip(isOpen ? "Hide rule" : "Edit rule")
					.onClick(() => {
						const nowOpen = !body.hasClass("bb-rule-body--open");
						body.toggleClass("bb-rule-body--open", nowOpen);
						button.setIcon(
							nowOpen ? "chevron-down" : "chevron-right",
						);
						button.setTooltip(nowOpen ? "Hide rule" : "Edit rule");

						if (nowOpen) {
							this.openRuleIndices.add(ruleIndex);
						} else {
							this.openRuleIndices.delete(ruleIndex);
						}
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Delete rule")
					.onClick(() => {
						const currentIndex =
							this.plugin.settings.rules.indexOf(rule);
						if (currentIndex === -1) return;
						this.plugin.settings.rules.splice(currentIndex, 1);

						const updated = new Set<number>();
						for (const i of this.openRuleIndices) {
							if (i < currentIndex) updated.add(i);
							else if (i > currentIndex) updated.add(i - 1);
						}
						this.openRuleIndices = updated;

						void this.triggerRefresh();
						this.refreshSettingsTab();
					}),
			);

		body = container.createDiv("bb-rule-body");
		if (isOpen) {
			body.addClass("bb-rule-body--open");
		}

		new Setting(body)
			.setName("Rule name")
			.addText((text) => {
				text.setPlaceholder("Rule name")
					.setValue(rule.name || "Rule")
					.onChange((value) => {
						rule.name = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-rule-title");
				text.inputEl.addEventListener("blur", () => {
					this.refreshSettingsTab();
				});
			});

		new Setting(body)
			.setName("Description")
			.addTextArea((text) => {
				text.setPlaceholder("What this formatting rule is for")
					.setValue(rule.description ?? "")
					.onChange((value) => {
						rule.description = value.trim() || undefined;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
				text.inputEl.addEventListener("blur", () => {
					this.refreshSettingsTab();
				});
			});

		new Setting(body)
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

		new Setting(body)
			.setName("Custom bullet CSS")
			.setDesc(
				"Overrides hierarchy CSS for the bullet symbol. Spacing is controlled by the bullet structure settings.",
			)
			.addTextArea((text) => {
				text.setPlaceholder(cssPlaceholder)
					.setValue(rule.bulletCss ?? "")
					.onChange((value) => {
						rule.bulletCss = value.trim() || undefined;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
			});

		new Setting(body)
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

		new Setting(body)
			.setName("Patterns and styles")
			.setDesc(
				"Each pattern is a regex matched against the bullet text. The first matching pattern's CSS is applied.",
			);

		this.renderPatternsTable(body, rule);
	}

	private renderRuleNameSetting(setting: Setting, rule: FormattingRule) {
		setting.setName("Rule name").addText((text) => {
			text.setPlaceholder("Rule name")
				.setValue(rule.name || "Rule")
				.onChange((value) => {
					rule.name = value;
					void this.triggerRefresh();
				});
			text.inputEl.classList.add("bb-rule-title");
			text.inputEl.addEventListener("blur", () => {
				this.refreshSettingsTab();
			});
		});
	}

	private renderRuleDescriptionSetting(
		setting: Setting,
		rule: FormattingRule,
	) {
		setting.setName("Description").addTextArea((text) => {
			text.setPlaceholder("What this formatting rule is for")
				.setValue(rule.description ?? "")
				.onChange((value) => {
					rule.description = value.trim() || undefined;
					void this.triggerRefresh();
				});
			text.inputEl.classList.add("bb-textarea");
			text.inputEl.addEventListener("blur", () => {
				this.refreshSettingsTab();
			});
		});
	}

	private renderRuleBulletSetting(setting: Setting, rule: FormattingRule) {
		setting
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
	}

	private renderRuleBulletCssSetting(setting: Setting, rule: FormattingRule) {
		setting
			.setName("Custom bullet CSS")
			.setDesc(
				"Overrides hierarchy CSS for the bullet symbol. Spacing is controlled by the bullet structure settings.",
			)
			.addTextArea((text) => {
				text.setPlaceholder(cssPlaceholder)
					.setValue(rule.bulletCss ?? "")
					.onChange((value) => {
						rule.bulletCss = value.trim() || undefined;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
			});
	}

	private renderRuleMatchModeSetting(setting: Setting, rule: FormattingRule) {
		setting
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
	}

	renderPatternsTable(container: HTMLElement, rule: FormattingRule) {
		rule.styles.forEach((styleConfig, index) => {
			this.createPatternSetting(container, rule, styleConfig, index);
		});

		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add pattern")
					.setCta()
					.onClick(() => this.addPattern(rule)),
			)
			.addButton((button) => {
				button.setButtonText("Remove last").onClick(() => {
					this.deletePattern(rule, rule.styles.length - 1);
				});
				button.setDisabled(rule.styles.length <= 1);
			});
	}

	private addPattern(rule: FormattingRule) {
		const currentRuleIndex = this.plugin.settings.rules.indexOf(rule);
		if (currentRuleIndex === -1) return;
		this.plugin.settings.rules[currentRuleIndex]!.styles.push({
			pattern: "",
			css: "",
		});
		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	private deletePattern(rule: FormattingRule, index: number) {
		const currentRuleIndex = this.plugin.settings.rules.indexOf(rule);
		if (currentRuleIndex === -1) return;
		const styles = this.plugin.settings.rules[currentRuleIndex]!.styles;
		if (styles.length <= 1) return;
		styles.splice(index, 1);
		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	createPatternSetting(
		container: HTMLElement,
		rule: FormattingRule,
		styleConfig: { pattern: string; css: string },
		index: number,
	) {
		this.renderPatternSetting(new Setting(container), styleConfig, index);
	}

	private renderPatternSetting(
		setting: Setting,
		styleConfig: { pattern: string; css: string },
		index: number,
	) {
		let patternInput: HTMLInputElement;

		setting
			.setName(`Pattern ${index + 1}`)
			.setDesc("Regex and CSS for this text segment.")
			.setClass("bb-pattern-setting")
			.addText((text) => {
				text.setPlaceholder("Regex")
					.setValue(styleConfig.pattern)
					.onChange((value) => {
						validatePattern(value);
						styleConfig.pattern = value;
						void this.triggerRefresh();
					});
				patternInput = text.inputEl;
				text.inputEl.classList.add("bb-pattern-input");
			})
			.addTextArea((text) => {
				text.setPlaceholder("CSS styles")
					.setValue(styleConfig.css)
					.onChange((value) => {
						styleConfig.css = value;
						void this.triggerRefresh();
					});
				text.inputEl.classList.add("bb-textarea");
			});

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
	}

	private deleteRule(rule: FormattingRule, fallbackIndex: number) {
		const currentIndex = this.plugin.settings.rules.indexOf(rule);
		const deleteIndex = currentIndex === -1 ? fallbackIndex : currentIndex;
		if (deleteIndex < 0) return;
		this.plugin.settings.rules.splice(deleteIndex, 1);

		const updated = new Set<number>();
		for (const i of this.openRuleIndices) {
			if (i < deleteIndex) updated.add(i);
			else if (i > deleteIndex) updated.add(i - 1);
		}
		this.openRuleIndices = updated;

		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	addNewRule() {
		const newRule: FormattingRule = {
			name: "New Rule",
			matchMode: "full",
			styles: [{ pattern: "", css: "" }],
		};
		this.plugin.settings.rules.push(newRule);
		void this.triggerRefresh();
		this.refreshSettingsTab();
	}

	async triggerRefresh() {
		await this.plugin.saveSettings();
		this.plugin.refreshEditors();
	}

	private refreshSettingsTab() {
		const tab = this as BetterBulletsSettingTab & {
			update?: () => void;
		};

		if (tab.update) {
			tab.update();
		}
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
			cls: "mod-warning",
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
