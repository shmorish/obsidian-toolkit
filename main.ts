import { Plugin } from "obsidian";
import { CalendarView, VIEW_CALENDAR } from "./calendar";

// 機能はここに足していく。community プラグインを入れずに済むよう、自分で使うものだけ書く
export default class Toolkit extends Plugin {
  async onload() {
    this.registerView(VIEW_CALENDAR, (leaf) => new CalendarView(leaf));
    const open = () => this.app.workspace.ensureSideLeaf(VIEW_CALENDAR, "left", { active: true, reveal: true });
    this.addCommand({ id: "open-calendar", name: "カレンダーを開く", callback: open });
    this.addRibbonIcon("calendar", "カレンダーを開く", open);
    // 左サイドバーのファイル一覧の下に、別の区画で常に置いておく。ほかの場所にあれば外して置き直す
    this.app.workspace.onLayoutReady(() => {
      const ws = this.app.workspace;
      for (const leaf of ws.getLeavesOfType(VIEW_CALENDAR)) if (leaf.getRoot() !== ws.leftSplit) leaf.detach();
      void ws.ensureSideLeaf(VIEW_CALENDAR, "left", { split: true, reveal: false });
    });
  }
}
