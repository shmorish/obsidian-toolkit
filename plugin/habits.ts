import { Keymap, Plugin, TFile, setIcon } from "obsidian";
import { dailySettings, pathOf } from "./calendar";
import { moment } from "./templates";

// Monthly ノートの ```habits ブロックを「習慣 × 日付」の表にする。マスは手で塗るように、
// 押すたびに 空 → 斜線（少し） → 塗りつぶし（しっかり） → 空 と変わる。
// 記録はブロックの中に「習慣名: 日 日:2」の形で残すので、プラグインがなくても読める（:2 が塗りつぶし）。
// 「#」で始まる行は見出し。「目標」を含む見出しより下の習慣は名前に青、「生活」を含むなら黄色のマーカーを引く:
//   ```habits
//   # 目標達成に繋がる行動
//   英語: 1 2:2 5
//   # 生活習慣を良くする行動
//   早起き:
//   ```
// 月はノート名（YYYY-MM）から取る。右にはその日の Daily の「Highlight of the Day」（押すと Daily を開く）と、
// Daily のプロパティ satisfaction（1〜5 の満足度）を天気のアイコンで出す（1 が雷、5 が晴れ）
const WEATHER = ["cloud-lightning", "cloud-rain", "cloud", "cloud-sun", "sun"];

type Habit = { name: string; days: Map<number, number>; line: number; group: string };

function parse(src: string): Habit[] {
  const habits: Habit[] = [];
  let group = "";
  src.split("\n").forEach((l, line) => {
    const g = l.match(/^\s*#(.*)/);
    if (g) return void (group = g[1].includes("目標") ? "goal" : g[1].includes("生活") ? "life" : "");
    const m = l.match(/^\s*([^:]+?)\s*:\s*(.*)$/) ?? l.match(/^\s*(\S.*?)\s*$/);
    if (!m) return;
    const days = (m[2] ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.split(":").map(Number))
      .map(([d, level]): [number, number] => [d, level === 2 ? 2 : 1]);
    habits.push({ name: m[1], days: new Map(days), line, group });
  });
  return habits;
}

// 見出しの下から次の見出しまでの箇条書きを、空の行を除いてつなぐ
const highlightOf = (text: string) =>
  (text.split(/^## Highlight of the Day\s*$/m)[1] ?? "")
    .split(/^#/m)[0]
    .split("\n")
    .filter((l) => /^\s*[-*]\s/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
    .join(" / ");

const serialize = (h: Habit) =>
  `${h.name}: ${[...h.days]
    .sort(([a], [b]) => a - b)
    .map(([d, level]) => (level === 2 ? `${d}:2` : d))
    .join(" ")}`.trimEnd();

export function registerHabits(plugin: Plugin) {
  const { app } = plugin;

  // Daily の ```weather ブロック。天気のアイコンを 5 つ並べ、押すとプロパティ satisfaction に 1〜5 を入れる（同じのをもう一度押すと消す）
  plugin.registerMarkdownCodeBlockProcessor("weather", (_src, el, ctx) => {
    const file = app.vault.getFileByPath(ctx.sourcePath);
    if (!file) return;
    const row = el.createDiv({ cls: "tw:flex tw:gap-3" });
    const icons = WEATHER.map((icon, i) => {
      const b = row.createDiv({ cls: "toolkit-weather tw:cursor-pointer", attr: { "aria-label": `満足度 ${i + 1}` } });
      setIcon(b, icon);
      b.onclick = () =>
        void app.fileManager.processFrontMatter(file, (fm) => {
          fm.satisfaction = fm.satisfaction === i + 1 ? null : i + 1;
          paint(fm.satisfaction);
        });
      return b;
    });
    const paint = (score: number | null) => icons.forEach((b, i) => b.toggleClass("on", score === i + 1));
    paint(app.metadataCache.getFileCache(file)?.frontmatter?.satisfaction ?? null);
  });
  plugin.registerMarkdownCodeBlockProcessor("habits", async (src, el, ctx) => {
    const habits = parse(src);
    const name = ctx.sourcePath.split("/").pop()!.replace(/\.md$/, "");
    const month = moment(name, "YYYY-MM", true);
    if (!month.isValid()) return void el.createDiv({ text: "habits は YYYY-MM.md のノートで使う", cls: "tw:text-faint" });
    if (!habits.length) return void el.createDiv({ text: "1 行に 1 つ習慣を書く（例: 早起き）", cls: "tw:text-faint" });

    const today = moment();
    const n = month.daysInMonth();
    const days = Array.from({ length: n }, (_, i) => month.clone().date(i + 1));

    // 押したらブロックの中のその習慣の行を書き換える。Obsidian が描き直すので表はそのまま作り直される
    const toggle = async (h: Habit, d: number) => {
      const level = h.days.get(d) ?? 0;
      level === 2 ? h.days.delete(d) : h.days.set(d, level + 1);
      const info = ctx.getSectionInfo(el);
      const file = app.vault.getFileByPath(ctx.sourcePath);
      if (!info || !file) return;
      await app.vault.process(file, (text) => {
        const lines = text.split("\n");
        lines[info.lineStart + 1 + h.line] = serialize(h);
        return lines.join("\n");
      });
    };

    // 行が日付、列が習慣。今日の行は紫、土日は薄く
    const table = el.createEl("table", { cls: "toolkit-habits tw:text-sm tw:border-collapse" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th");
    for (const h of habits) head.createEl("th").createSpan({ text: h.name, cls: `toolkit-habit-name ${h.group}` });
    head.createEl("th", { cls: "toolkit-habits-highlight" }).createSpan({ text: "Highlight", cls: "tw:text-muted" });
    head.createEl("th").createSpan({ text: "Weather", cls: "tw:text-muted" });
    const daily = await dailySettings(app);

    const body = table.createEl("tbody");
    for (const d of days) {
      const tr = body.createEl("tr");
      const isToday = d.isSame(today, "day");
      tr.createEl("td").createSpan({
        text: d.format("D ddd"),
        cls: isToday ? "tw:text-purple tw:font-semibold" : d.day() === 0 || d.day() === 6 ? "tw:text-faint" : "tw:text-muted",
      });
      for (const h of habits) {
        const level = h.days.get(d.date()) ?? 0;
        const cell = tr.createEl("td", { cls: "tw:cursor-pointer", attr: { "aria-label": `${h.name} ${d.format("M/D")}` } });
        cell.createDiv({ cls: `toolkit-habit toolkit-habit-${level} ${isToday ? "toolkit-habit-today" : ""}` });
        cell.onclick = () => void toggle(h, d.date());
      }
      const file = app.vault.getAbstractFileByPath(pathOf(daily, d));
      const hl = tr.createEl("td", { cls: "toolkit-habits-highlight" });
      if (file instanceof TFile) {
        const span = hl.createSpan({ text: highlightOf(await app.vault.cachedRead(file)), cls: "tw:cursor-pointer" });
        span.onclick = (evt) => void app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(file);
      }
      const score = Number(file instanceof TFile && app.metadataCache.getFileCache(file)?.frontmatter?.satisfaction) || 0;
      const weather = WEATHER[Math.round(score) - 1];
      const td = tr.createEl("td", { attr: weather ? { "aria-label": `満足度 ${score}` } : {} });
      if (weather) setIcon(td.createDiv({ cls: `toolkit-weather s${Math.round(score)}` }), weather);
    }
  });
}
