import { WidgetType } from "@codemirror/view";
import { BulletType } from "./editor";
import { BetterBulletsSettings } from "./settings";

export class BulletWidget extends WidgetType {
	settings: BetterBulletsSettings;
	type: BulletType;

	constructor(settings: BetterBulletsSettings, type: BulletType) {
		super();
		this.settings = settings;
		this.type = type;
	}

	toDOM(): HTMLElement {
		const container = createEl("span");
		container.style.cssText = [
			`--bb-bullet-indentation: ${this.settings.bulletIndentation};`,
			`--bb-bullet-structure: ${this.settings.bulletStructure};`,
			`--bb-bullet-text-gap: ${this.settings.bulletTextGap};`,
			this.type.isOrdered ? "--bb-ordered-list: 1;" : "",
			this.type.isParent ? "--bb-parent-bullet: 1;" : "",
		].join(" ");
		container.classList.add(
			"bb-bullet",
			this.type.isOrdered
				? "bb-bullet--ordered"
				: "bb-bullet--unordered",
			this.type.isParent ? "bb-bullet--parent" : "bb-bullet--leaf",
		);

		const symbol = container.createEl("span", {
			cls: "bb-bullet-symbol",
			text: this.type.symbol,
		});
		symbol.style.cssText = this.type.style;

		return container;
	}
}
