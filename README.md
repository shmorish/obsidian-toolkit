# obsidian-toolkit

[Obsidian](https://obsidian.md) の自分用のプラグインとテーマ。community プラグインは入れず、使う機能だけをここに TypeScript で書く。

## 中身

| パス | 中身 |
|---|---|
| `main.ts`, `manifest.json` | 自作プラグイン `toolkit` |
| `themes/Mono/` | 色を使わないミニマルテーマ |

## 開発

```sh
make check   # 型チェック
make dev     # 変換して ~/Private/obsidian/.obsidian に置く。Obsidian で「Reload app without saving」を実行すると読み込まれる
```

テーマの CSS を手早く試すときは、Vault の `.obsidian/themes/Mono/theme.css` を直接書き換えて再読み込みし、決まったらここに写す。

PR と main への push で、CI が型チェックと変換を確かめる。

## 入れ方

[dotfiles](https://github.com/shmorish/dotfiles) の Home Manager が、この repo をコミット固定で取ってきて、`build.sh` で変換したものを Vault の `.obsidian/` に実ファイルとしてコピーする。変えたときの流れは次のとおり。

1. ここで変更して `make dev` で試す
2. コミットして push する
3. dotfiles の `nix/obsidian.nix` で、`toolkit` の `rev` と `hash` を上げる
4. `make switch`
