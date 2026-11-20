import { Plugin, TFile, moment as obsidianMoment } from "obsidian";
import type { Moment } from "moment";

// obsidian の型定義は moment を `import * as` で出しているので、TS 7 では呼び出せない型になる。moment 本体の型に直す
export const moment = obsidianMoment as unknown as typeof import("moment");

// フォルダごとのテンプレート。このフォルダ（下の階層も含む）に空のノートを作ると、テンプレートの中身を入れる。
// 重なるときは深いフォルダの指定を使う
const FOLDER_TEMPLATES: Record<string, string> = {
  "01_Daily": "90_Templates/Daily",
  "02_Projects": "90_Templates/Project",
};

// コアのテンプレートと同じく {{date}} {{time}} {{title}} と {{date:形式}} {{time:形式}} を埋める
export function fill(text: string, title: string, date: Moment, dateFormat = "YYYY-MM-DD"): string {
  return text.replace(/{{\s*(date|time|title)\s*(?::(.*?))?\s*}}/gi, (_, key: string, fmt?: string) => {
    key = key.toLowerCase();
    if (key === "title") return title;
    if (key === "time") return moment().format(fmt?.trim() || "HH:mm");
    return date.format(fmt?.trim() || dateFormat);
  });
}

export function registerFolderTemplates(plugin: Plugin) {
  const { app } = plugin;
  // 起動中は既存のファイルごとに create が飛ぶので、読み込みが終わってから見る
  app.workspace.onLayoutReady(() =>
    plugin.registerEvent(
      app.vault.on("create", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        const folder = Object.keys(FOLDER_TEMPLATES)
          .filter((f) => file.path.startsWith(f + "/"))
          .sort((a, b) => b.length - a.length)[0];
        const tpl = folder && app.metadataCache.getFirstLinkpathDest(FOLDER_TEMPLATES[folder], "");
        if (!tpl) return;
        const text = fill(await app.vault.read(tpl), file.basename, moment());
        // 中身つきで作られたノート（カレンダーやコアのデイリーノートから作ったもの）には触らない
        await app.vault.process(file, (data) => (data === "" ? text : data));
      }),
    ),
  );
}
