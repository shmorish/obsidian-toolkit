import { execFile } from "child_process";
import { FileSystemAdapter, Notice, Plugin } from "obsidian";
import { moment } from "./templates";

// Vault を git で自動バックアップする（前の obsidian-git の代わり）。
// 起動時に pull し、1 分ごとに「変更があれば commit → pull → push」する。失敗したときだけ通知を出す
const INTERVAL_MS = 60 * 1000;

export function registerAutoGit(plugin: Plugin) {
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return;
  const cwd = adapter.getBasePath();

  const git = (...args: string[]) =>
    new Promise<string>((resolve, reject) =>
      execFile("git", args, { cwd, timeout: 60_000 }, (err, stdout, stderr) =>
        err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout),
      ),
    );

  // 同時に 2 つ走らせない。走っている間に呼ばれた分は捨てる（次の回で拾える）
  let running = false;
  const run = async (what: string, job: () => Promise<unknown>) => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (e) {
      new Notice(`git の${what}に失敗しました\n${(e as Error).message}`, 10_000);
    } finally {
      running = false;
    }
  };

  // 衝突して rebase が止まったら元に戻す。途中のまま残すと、以降の commit がすべて失敗する
  const sync = async () => {
    try {
      await git("pull", "--rebase", "--autostash");
    } catch (e) {
      await git("rebase", "--abort").catch(() => {});
      throw e;
    }
  };
  const pull = () => run("pull", sync);
  // 変更がなくても pull と push はする。前の回に push できなかった commit もここで送れる
  const backup = () =>
    run("バックアップ", async () => {
      if ((await git("status", "--porcelain")).trim() !== "") {
        await git("add", "-A");
        await git("commit", "-m", `vault backup: ${moment().format("YYYY-MM-DD HH:mm:ss")}`);
      }
      await sync();
      await git("push");
    });

  plugin.app.workspace.onLayoutReady(() => void pull());
  plugin.registerInterval(window.setInterval(() => void backup(), INTERVAL_MS));
  plugin.addCommand({ id: "git-backup", name: "git: 今すぐバックアップ", callback: () => void backup() });
  plugin.addCommand({ id: "git-pull", name: "git: pull", callback: () => void pull() });
}
