# obsidian-toolkit

Obsidian の拡張（プラグイン・テーマなど）をすべてここで管理する。必要なものは基本ここに書く（プラグインは TypeScript、テーマは CSS）。自作するには重いもの（今は Tasks）だけ、community プラグインを dotfiles の `nix/obsidian.nix` でバージョン固定で入れる。今あるのは自作プラグイン `toolkit`（`main.ts`, `manifest.json`）とテーマ `themes/Mono/`。概要は README.md を読む。

## 守ること

- 自分で使う機能だけを書く。実行時の依存は入れない（`obsidian` と `@codemirror/*` は Obsidian が実行時に渡すので import してよい）。npm の依存は変換に使う開発用だけ
- 変更したら `make check` で型チェックを通す。動作確認は `make dev`（Vault に置いてプラグインを読み込み直す）。そのあと `obsidian dev:console level=error`・`obsidian dev:errors`・`obsidian dev:screenshot path=…` で自分で確かめる。console は先に `obsidian dev:debug on` が要る
- プラグインの UI は Tailwind で書く。クラスは `tw:` つき、色は `styles.css` で Obsidian の変数に結びつけたものだけ。preflight は入れない
- Release の tar.gz の中身（`plugin/`, `themes/`）の形は dotfiles 側が前提にしているので、変えるときは [shmorish/dotfiles](https://github.com/shmorish/dotfiles) の `nix/obsidian.nix` も合わせて直す
- 反映は dotfiles が Release を取り込む。`manifest.json` の `version` を上げて main に push すると CI がタグと Release を作る（上げないと作られない）。そのあと dotfiles で URL のタグと `hash` を上げて `make switch` する（手順は README）
