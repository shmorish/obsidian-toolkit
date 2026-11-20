import { App, Modal, TFile, normalizePath } from "obsidian";
import { fill, moment } from "./templates";

// カレンダーの下の「1on1」ボタン。相手の名前を聞いて、今日の 1on1 ノートを作って開く（もうあれば開くだけ）
const FOLDER = "03_Notes/01_仕事/1on1";
const TEMPLATE = "90_Templates/1on1";

export function askOneOnOne(app: App) {
  const modal = new Modal(app);
  modal.setTitle("1on1 を作成");
  const input = modal.contentEl.createEl("input", {
    type: "text",
    placeholder: "相手の名前（例: 山田さん）",
    cls: "tw:w-full",
  });
  input.onkeydown = (evt) => {
    if (evt.key !== "Enter" || evt.isComposing) return;
    const name = input.value.trim();
    if (!name) return;
    modal.close();
    void openOneOnOne(app, name);
  };
  modal.open();
  input.focus();
}

async function openOneOnOne(app: App, name: string) {
  const date = moment();
  const path = normalizePath(`${FOLDER}/${date.format("YYYY-MM-DD")} ${name}.md`);
  let file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    if (!app.vault.getAbstractFileByPath(FOLDER)) await app.vault.createFolder(FOLDER);
    const tpl = app.metadataCache.getFirstLinkpathDest(TEMPLATE, "");
    file = await app.vault.create(path, tpl ? fill(await app.vault.read(tpl), name, date) : "");
    await app.fileManager.processFrontMatter(file as TFile, (fm) => (fm.with = name));
  }
  await app.workspace.getLeaf().openFile(file as TFile);
}
