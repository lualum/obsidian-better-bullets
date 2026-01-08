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
      const span = document.createElement("span");

      span.textContent = this.type.symbol;
      span.style.cssText = this.type.style || "";
      span.style.position = "relative";
      span.style.left = "1.0em";
      span.style.transform = "translateX(-50%)";
      span.style.display = "inline-block";

      return span;
   }
}
