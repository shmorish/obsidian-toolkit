import { App, ItemView, Keymap, Modal, Setting, TFile, moment as obsidianMoment, normalizePath } from "obsidian";
import type { Moment } from "moment";

// obsidian の型定義は moment を `import * as` で出しているので、TS 7 では呼び出せない型になる。moment 本体の型に直す
const moment = obsidianMoment as unknown as typeof import("moment");

// サイドバーの月カレンダー。日付をクリックすると、その日の Daily ノートを開く（なければ確認して作る）。
// Daily ノートの置き場所・名前の形式・テンプレートは、コアの「デイリーノート」の設定をそのまま使う
export const VIEW_CALENDAR = "toolkit-calendar";

type Daily = { folder: string; format: string; template: string };

async function dailySettings(app: App): Promise<Daily> {
  let s: Partial<Daily> = {};
  try {
    s = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/daily-notes.json`));
  } catch {
    // 未設定ならファイルがない。コアと同じ既定値を使う
  }
  return { folder: s.folder ?? "", format: s.format || "YYYY-MM-DD", template: s.template ?? "" };
}

const pathOf = (d: Daily, date: Moment) => normalizePath(`${d.folder}/${date.format(d.format)}.md`);

// 開いているノートが Daily ならその日付。Daily でなければ null
function dateOf(d: Daily, file: TFile | null): Moment | null {
  const prefix = d.folder ? normalizePath(d.folder) + "/" : "";
  if (!file || file.extension !== "md" || !file.path.startsWith(prefix)) return null;
  const date = moment(file.path.slice(prefix.length, -".md".length), d.format, true);
  return date.isValid() ? date : null;
}

// コアのテンプレートと同じく {{date}} {{time}} {{title}} と {{date:形式}} を埋める。日付はクリックした日
function fill(text: string, d: Daily, date: Moment): string {
  return text.replace(/{{\s*(date|time|title)\s*(?::(.*?))?\s*}}/gi, (_, key: string, fmt?: string) => {
    key = key.toLowerCase();
    if (key === "title") return date.format(d.format);
    if (key === "time") return moment().format(fmt?.trim() || "HH:mm");
    return date.format(fmt?.trim() || d.format);
  });
}

async function createDaily(app: App, d: Daily, date: Moment): Promise<TFile> {
  const path = pathOf(d, date);
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir && !app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir);
  const tpl = d.template && app.metadataCache.getFirstLinkpathDest(d.template, "");
  return app.vault.create(path, tpl ? fill(await app.vault.read(tpl), d, date) : "");
}

class ConfirmModal extends Modal {
  constructor(app: App, message: string, onYes: () => void) {
    super(app);
    this.setTitle(message);
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("作成").setCta().onClick(() => {
          this.close();
          onYes();
        }),
      )
      .addButton((b) => b.setButtonText("やめる").onClick(() => this.close()));
  }
}

export class CalendarView extends ItemView {
  private month = moment().startOf("month");

  getViewType() {
    return VIEW_CALENDAR;
  }
  getDisplayText() {
    return "カレンダー";
  }
  getIcon() {
    return "calendar";
  }

  async onOpen() {
    const redraw = () => void this.render();
    this.registerEvent(this.app.vault.on("create", redraw));
    this.registerEvent(this.app.vault.on("delete", redraw));
    this.registerEvent(this.app.vault.on("rename", redraw));
    this.registerEvent(this.app.workspace.on("file-open", redraw));
    // 日付が変わったら「今日」の印を動かす
    let today = moment().format("YYYYMMDD");
    this.registerInterval(
      window.setInterval(() => {
        const now = moment().format("YYYYMMDD");
        if (now !== today) {
          today = now;
          redraw();
        }
      }, 60_000),
    );
    await this.render();
  }

  private async render() {
    const d = await dailySettings(this.app);
    const active = dateOf(d, this.app.workspace.getActiveFile());
    const el = this.contentEl;
    el.empty();

    const head = el.createDiv({ cls: "tw:flex tw:items-center tw:mb-2" });
    head.createSpan({ text: this.month.format("YYYY年 M月"), cls: "tw:flex-1 tw:font-semibold" });
    const nav = (icon: string, label: string, to: () => Moment) => {
      const b = head.createDiv({ cls: "clickable-icon", attr: { "aria-label": label } });
      b.setText(icon);
      b.onclick = () => {
        this.month = to();
        void this.render();
      };
    };
    nav("‹", "前の月", () => this.month.clone().subtract(1, "month"));
    nav("今日", "今月", () => moment().startOf("month"));
    nav("›", "次の月", () => this.month.clone().add(1, "month"));

    const grid = el.createDiv({ cls: "tw:grid tw:grid-cols-7 tw:gap-y-1 tw:text-center tw:text-sm" });
    for (const w of moment.weekdaysMin(true)) grid.createDiv({ text: w, cls: "tw:text-faint tw:text-xs" });

    const end = this.month.clone().endOf("month").endOf("week");
    for (const day = this.month.clone().startOf("week"); day.isSameOrBefore(end, "day"); day.add(1, "day")) {
      const date = day.clone();
      const file = this.app.vault.getAbstractFileByPath(pathOf(d, date));
      const cell = grid.createDiv({
        cls: [
          "tw:py-1 tw:rounded tw:cursor-pointer tw:hover:bg-secondary",
          date.isSame(this.month, "month") ? "tw:text-muted" : "tw:text-faint",
          date.isSame(moment(), "day") ? "tw:text-normal tw:font-bold" : "",
          active?.isSame(date, "day") ? "tw:bg-secondary" : "",
        ].join(" "),
      });
      cell.createDiv({ text: String(date.date()) });
      // ノートがある日だけ点を出す（ない日も同じ高さを取って並びを揃える）
      cell.createDiv({ cls: `tw:mx-auto tw:size-1 tw:rounded-full ${file ? "tw:bg-muted" : ""}` });
      cell.onclick = (evt) => this.open(d, date, Keymap.isModEvent(evt));
    }
  }

  private open(d: Daily, date: Moment, newTab: ReturnType<typeof Keymap.isModEvent>) {
    const go = (f: TFile) => this.app.workspace.getLeaf(newTab).openFile(f);
    const file = this.app.vault.getAbstractFileByPath(pathOf(d, date));
    if (file instanceof TFile) return void go(file);
    new ConfirmModal(this.app, `${date.format(d.format)} のノートを作りますか？`, async () =>
      go(await createDaily(this.app, d, date)),
    ).open();
  }
}
