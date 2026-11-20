import { App, Component, Keymap, TFile, moment as obsidianMoment, normalizePath } from "obsidian";
import type { Moment } from "moment";

// obsidian の型定義は moment を `import * as` で出しているので、TS 7 では呼び出せない型になる。moment 本体の型に直す
const moment = obsidianMoment as unknown as typeof import("moment");

// 左サイドバーの一番上（アイコン行の下、フォルダ一覧の上）に埋め込む月カレンダー。日付をクリックすると、その日の Daily ノートを開く（なければ作る）。
// Daily ノートの置き場所・名前の形式・テンプレートは、コアの「デイリーノート」の設定をそのまま使う
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

export class Calendar extends Component {
  private month = moment().startOf("month");
  private el = createDiv({ cls: "tw:flex-none tw:px-3 tw:pt-1 tw:pb-3 tw:border-b tw:border-border" });

  constructor(private app: App) {
    super();
  }

  onload() {
    // タブを切り替えても残るよう、左サイドバーの最初のタブ群の、アイコン行と中身の間に置く。
    // タブを並べ替えると Obsidian が DOM を組み直すので、レイアウトが変わるたびに置き直す
    const place = () => {
      const tabs = this.app.workspace.containerEl.querySelector(".mod-left-split > .workspace-tabs");
      const body = tabs?.querySelector(":scope > .workspace-tab-container");
      if (tabs && body && this.el.nextElementSibling !== body) tabs.insertBefore(this.el, body);
    };
    this.registerEvent(this.app.workspace.on("layout-change", place));
    place();

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
    void this.render();
  }

  onunload() {
    this.el.remove();
  }

  private async render() {
    const d = await dailySettings(this.app);
    const active = dateOf(d, this.app.workspace.getActiveFile());
    const el = this.el;
    el.empty();

    const head = el.createDiv({ cls: "tw:flex tw:items-center tw:mb-2" });
    const title = head.createDiv({ cls: "tw:flex-1 tw:flex tw:items-baseline tw:gap-2" });
    title.createSpan({ text: this.month.format("YYYY"), cls: "tw:text-sm tw:text-muted" });
    title.createSpan({ text: this.month.format("M月"), cls: "tw:text-lg tw:font-semibold tw:text-purple" });
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
          active?.isSame(date, "day") ? "tw:bg-secondary" : "",
        ].join(" "),
      });
      // 今日は紫の丸に白い数字
      cell.createDiv({
        text: String(date.date()),
        cls: `tw:mx-auto tw:size-7 tw:grid tw:place-items-center tw:rounded-full ${
          date.isSame(moment(), "day") ? "tw:bg-purple tw:text-white tw:font-semibold" : ""
        }`,
      });
      // ノートがある日だけ点を出す（ない日も同じ高さを取って並びを揃える）
      cell.createDiv({ cls: `tw:mx-auto tw:mt-1 tw:size-1 tw:rounded-full ${file ? "tw:bg-muted" : ""}` });
      cell.onclick = (evt) => void this.openDaily(d, date, Keymap.isModEvent(evt));
    }
  }

  private async openDaily(d: Daily, date: Moment, newTab: ReturnType<typeof Keymap.isModEvent>) {
    const file = this.app.vault.getAbstractFileByPath(pathOf(d, date));
    await this.app.workspace.getLeaf(newTab).openFile(file instanceof TFile ? file : await createDaily(this.app, d, date));
  }
}
