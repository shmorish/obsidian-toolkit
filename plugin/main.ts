import { Plugin } from "obsidian";
import { registerAutoGit } from "./autogit";
import { Calendar } from "./calendar";
import { registerHabits } from "./habits";
import { registerFolderTemplates } from "./templates";
import { registerWeekly } from "./weekly";

// 機能はここに足していく。自分で使うものだけ書く
export default class Toolkit extends Plugin {
  async onload() {
    this.app.workspace.onLayoutReady(() => this.addChild(new Calendar(this.app)));
    registerFolderTemplates(this);
    registerHabits(this);
    registerWeekly(this);
    registerAutoGit(this);
  }
}
