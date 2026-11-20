import { Plugin } from "obsidian";
import { Calendar } from "./calendar";

// 機能はここに足していく。community プラグインを入れずに済むよう、自分で使うものだけ書く
export default class Toolkit extends Plugin {
  async onload() {
    this.app.workspace.onLayoutReady(() => this.addChild(new Calendar(this.app)));
  }
}
