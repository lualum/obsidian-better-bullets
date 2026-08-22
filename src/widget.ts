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
		const container = document.createElement("span");
		container.style.cssText = [
			`--bb-bullet-indentation: ${this.settings.bulletIndentation};`,
			`--bb-bullet-structure: ${this.settings.bulletStructure};`,
			`--bb-bullet-text-gap: ${this.settings.bulletTextGap};`,
		].join(" ");
		container.classList.add("bb-bullet");

		const symbol = container.createEl("span", {
			cls: "bb-bullet-symbol",
			text: this.type.symbol,
		});
		symbol.style.cssText = this.type.style;

		return container;
	}
}
