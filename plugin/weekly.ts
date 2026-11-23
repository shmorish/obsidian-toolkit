import { Keymap, MarkdownRenderChild, MarkdownRenderer, Plugin } from "obsidian";
import { dailySettings, pathOf } from "./calendar";
import { moment } from "./templates";

// Monthly の ```weekly ブロック。その月の金曜ごとに、金曜の Daily に書いた「## Weekly Review」をカードで並べる。
// 振り返りは金曜の Daily で書く（Daily のテンプレートは金曜にだけこの欄を入れる）。見出しを押すとその Daily を開く
const reviewOf = (text: string) =>
  (text.split(/^## Weekly Review\s*$/m)[1] ?? "").split(/^## /m)[0].trim();

// テンプレートのままの「- Keep:」だけなら、まだ書いていない
const isBlank = (review: string) => !review.replace(/^\s*-\s*(Keep|Problem|Try):\s*$/gm, "").trim();

export function registerWeekly(plugin: Plugin) {
  const { app } = plugin;
  plugin.registerMarkdownCodeBlockProcessor("weekly", async (_src, el, ctx) => {
    const month = moment(ctx.sourcePath.split("/").pop()!.replace(/\.md$/, ""), "YYYY-MM", true);
    if (!month.isValid()) return void el.createDiv({ text: "weekly は Monthly（YYYY-MM.md）で使う", cls: "tw:text-faint" });
    const daily = await dailySettings(app);
    const fridays = Array.from({ length: month.daysInMonth() }, (_, i) => month.clone().date(i + 1)).filter((d) => d.day() === 5);
    const paths = fridays.map((d) => pathOf(daily, d));
    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);

    const draw = async () => {
      el.empty();
      for (const [i, fri] of fridays.entries()) {
        const card = el.createDiv({ cls: "toolkit-week" });
        const title = card.createDiv({ text: `${fri.clone().subtract(4, "day").format("M/D")} – ${fri.format("M/D")}`, cls: "toolkit-week-title" });
        const file = app.vault.getFileByPath(paths[i]);
        const review = file ? reviewOf(await app.vault.cachedRead(file)) : "";
        if (file) {
          title.addClass("tw:cursor-pointer");
          title.onclick = (evt) => void app.workspace.getLeaf(Keymap.isModEvent(evt)).openFile(file);
        }
        if (file && !isBlank(review)) await MarkdownRenderer.render(app, review, card.createDiv(), file.path, child);
        else card.createDiv({ text: "まだ書いていない", cls: "tw:text-sm tw:text-faint" });
      }
    };
    await draw();
    // 金曜の Daily を書き換えたら描き直す
    child.registerEvent(app.vault.on("modify", (f) => void (paths.includes(f.path) && draw())));
  });
}
