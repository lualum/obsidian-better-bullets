import { App, Modal, PluginSettingTab, Setting, SettingGroup } from "obsidian";
import type BetterBulletsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./default";

const cssPlaceholder = "e.g. \n\nfont-size: 1em; \ncolor: red;";

export interface BulletType {
	symbol: string;
	css: string;
}

export type LevelType = "hierarchy" | "indent";
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
	levelType: LevelType;
	bulletIndentation: string;
	bulletStructure: string;
	bulletTextGap: string;
	hierarchy: BulletType[];
	rules: FormattingRule[];
}

export class BetterBulletsSettingTab extends PluginSettingTab {
	plugin: BetterBulletsPlugin;

	private openRuleIndices: Set<number> = new Set();

	constructor(app: App, plugin: BetterBulletsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl: page } = this;
		page.empty();

		new Setting(page).setName("Hierarchy configuration").setHeading();
		this.renderLevelSettings(page);

		new Setting(page).setName("Bullet structure").setHeading();
		this.renderBulletStructureSettings(page);

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
		const container = page.createDiv("bb-settings-section");

		new Setting(container)
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

		for (let i = 0; i < this.plugin.settings.hierarchy.length; i++) {
			this.createLevelSetting(container, i);
		}

		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add level")
					.setCta()
					.onClick(() => {
						const index = this.plugin.settings.hierarchy.length;
						const newLevel: BulletType = DEFAULT_SETTINGS.hierarchy[
							index
						]
							? { ...DEFAULT_SETTINGS.hierarchy[index] }
							: { symbol: "*", css: "" };
						this.plugin.settings.hierarchy.push(newLevel);
						void this.triggerRefresh();
						this.refreshSettingsTab();
					}),
			)
			.addButton((button) => {
				button.setButtonText("Remove last").onClick(() => {
					if (this.plugin.settings.hierarchy.length <= 1) return;
					this.plugin.settings.hierarchy.pop();
					void this.triggerRefresh();
					this.refreshSettingsTab();
				});
				button.setDisabled(this.plugin.settings.hierarchy.length <= 1);
			});
	}

	createLevelSetting(container: HTMLElement, index: number) {
		const level = this.getLevelStyle(index);

		new Setting(container)
			.setName(`Level ${index + 1}`)
			.setDesc("Bullet symbol and CSS for this level.")
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

	renderBulletStructureSettings(page: HTMLElement) {
		const container = page.createDiv("bb-settings-section");

		new Setting(container)
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

		new Setting(container)
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

		new Setting(container)
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
					new ConfirmResetModal(this.app, () => {
						this.plugin.settings.rules = DEFAULT_SETTINGS.rules.map(
							(r) => ({
								...r,
								styles: r.styles.map((s) => ({ ...s })),
							}),
						);
						this.openRuleIndices.clear();
						void this.triggerRefresh();
						this.refreshSettingsTab();
					}).open();
				}),
			);
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

	renderPatternsTable(container: HTMLElement, rule: FormattingRule) {
		rule.styles.forEach((styleConfig, index) => {
			this.createPatternSetting(container, rule, styleConfig, index);
		});

		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add pattern")
					.setCta()
					.onClick(() => {
						const currentRuleIndex =
							this.plugin.settings.rules.indexOf(rule);
						if (currentRuleIndex === -1) return;
						this.plugin.settings.rules[
							currentRuleIndex
						]!.styles.push({
							pattern: "",
							css: "",
						});
						void this.triggerRefresh();
						this.refreshSettingsTab();
					}),
			)
			.addButton((button) => {
				button.setButtonText("Remove last").onClick(() => {
					const currentRuleIndex =
						this.plugin.settings.rules.indexOf(rule);
					if (currentRuleIndex === -1) return;
					const styles =
						this.plugin.settings.rules[currentRuleIndex]!.styles;
					if (styles.length <= 1) return;
					styles.pop();
					void this.triggerRefresh();
					this.refreshSettingsTab();
				});
				button.setDisabled(rule.styles.length <= 1);
			});
	}

	createPatternSetting(
		container: HTMLElement,
		rule: FormattingRule,
		styleConfig: { pattern: string; css: string },
		index: number,
	) {
		let patternInput: HTMLInputElement;

		new Setting(container)
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
		} else {
			this.display();
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
