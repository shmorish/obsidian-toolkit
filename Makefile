VAULT := $(HOME)/Private/obsidian/.obsidian

.PHONY: check build dev

node_modules: package.json
	npm install
	@touch node_modules

# 型チェック
check: node_modules
	npx tsc -p .

# dist に変換結果を置く
build: node_modules
	PATH="$(CURDIR)/node_modules/.bin:$$PATH" ./build.sh dist

# 手元の Vault に直接置いて、Obsidian にプラグインを読み込み直させる（次の make switch で dotfiles の固定版に戻る）。
# Obsidian の CLI（設定 → 一般 → 詳細設定）をオンにしておく。エラーは obsidian dev:errors / dev:console で見る
dev: build
	cp dist/plugin/* $(VAULT)/plugins/toolkit/
	cp -R dist/themes/* $(VAULT)/themes/
	obsidian plugin:reload id=toolkit
