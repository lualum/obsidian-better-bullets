import { Plugin } from "obsidian";
import { bulletReplacementPlugin } from "./editor";
import {
   BetterBulletsSettings,
   BetterBulletsSettingTab,
   DEFAULT_SETTINGS,
} from "./settings";

export default class BetterBulletsPlugin extends Plugin {
   settings: BetterBulletsSettings;

   async onload() {
      await this.loadSettings();
      this.registerEditorExtension([bulletReplacementPlugin(this)]);
      this.addSettingTab(new BetterBulletsSettingTab(this.app, this));
   }

   async loadSettings() {
      this.settings = Object.assign(
         {},
         DEFAULT_SETTINGS,
         await this.loadData()
      );
   }

   async saveSettings() {
      await this.saveData(this.settings);
   }

   refreshEditors() {
      this.app.workspace.iterateAllLeaves((leaf) => {
         // @ts-ignore - accessing internal editor
         const view = leaf.view?.editor?.cm;
         if (view)
            view.dispatch({
               selection: view.state.selection,
            });
      });
   }
}
