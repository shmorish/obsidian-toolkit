# obsidian-toolkit

[Obsidian](https://obsidian.md) の拡張（プラグイン・テーマなど）をすべて管理する repo。必要なものは基本ここに書く。自作するには重いもの（今は Tasks）だけ、community プラグインを [dotfiles](https://github.com/shmorish/dotfiles) の `nix/obsidian.nix` でバージョン固定で入れる。プラグインは TypeScript、テーマは CSS で書く。

## 中身

| パス | 中身 |
|---|---|
| `plugin/main.ts`, `plugin/manifest.json` | 自作プラグイン `toolkit` |
| `plugin/calendar.ts` | 左サイドバーの一番上に埋め込む月カレンダー。日付をクリックするとその日の Daily ノートを、年月をクリックするとその月の Monthly ノート（`02_Monthly/YYYY-MM`）を開く（なければ作る） |
| `plugin/oneonone.ts` | カレンダーの下の「＋ 1on1」ボタン。相手の名前を聞いて、`03_Notes/01_仕事/1on1/` に今日の 1on1 ノートを作って開く（テンプレートは `90_Templates/1on1`） |
| `plugin/templates.ts` | フォルダごとのテンプレート。指定したフォルダに空のノートを作ると、テンプレートの中身を入れる（対応はファイル内の `FOLDER_TEMPLATES`） |
| `plugin/autogit.ts` | Vault の自動バックアップ。起動時に pull し、1 分ごとに変更があれば commit → pull → push する。コマンド「git: 今すぐバックアップ」「git: pull」もある |
| `plugin/styles.css` | `toolkit` の UI 用 CSS。Tailwind で変換する |
| `themes/Mono/` | 色を使わないミニマルテーマ |

## 開発

```sh
make check   # 型チェック
make dev     # 変換して ~/Private/obsidian/.obsidian に置き、Obsidian にプラグインを読み込み直させる
```

`make dev` は Obsidian の CLI を使うので、設定 → 一般 → 詳細設定 でオンにしておく。エラーは `obsidian dev:errors`、画面は `obsidian dev:screenshot path=…` で確かめられる。

テーマの CSS を手早く試すときは、Vault の `.obsidian/themes/Mono/theme.css` を直接書き換えて再読み込みし、決まったらここに写す。

プラグインの UI は Tailwind のクラスで書く。Obsidian 本体の見た目を崩さないよう preflight は入れず、クラスには `tw:` をつける（例: `tw:flex`）。色は Obsidian の変数に結びつけたものだけを使う（`tw:text-muted`, `tw:bg-secondary` など。一覧は `plugin/styles.css`）。

PR と main への push で、CI が型チェックと変換を確かめる。

## 入れ方

main に push すると、`plugin/manifest.json` の `version` に当たる Release（例: `v0.2.0`）がまだなければ、CI がタグを作り、変換結果を `obsidian-toolkit.tar.gz` にまとめて GitHub Release に置く。[dotfiles](https://github.com/shmorish/dotfiles) の Home Manager がそれを取ってきて、Vault の `.obsidian/` に実ファイルとしてコピーする。変えたときの流れは次のとおり。

1. ここで変更して `make dev` で試す
2. `plugin/manifest.json` の `version` を上げてコミットし、main に push する（`version` を上げないと Release は作られない）
3. dotfiles の `nix/obsidian.nix` で、`toolkit` の URL のタグと `hash` を上げる
4. `make switch`
