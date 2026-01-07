import { WidgetType } from "@codemirror/view";
import { BulletType } from "editor";
import { BetterBulletsSettings } from "settings";

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
      span.textContent = " " + this.type.symbol;
      span.style = this.type.style || "";
      return span;
   }
}
