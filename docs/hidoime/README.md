# ヒドイメ：Claude向け引き継ぎ

まず [HIDOIME_HANDOFF.md](./HIDOIME_HANDOFF.md) を読んでください。

このブランチは仕様書とグラフィックス見本だけを追加した引き継ぎ用です。ゲーム本体への統合・mainへのマージはまだ許可されていません。

## ファイル

- [仕様書](./HIDOIME_HANDOFF.md)：見た目、2色、HP別密度、消滅演出、未決定事項。
- [描画・HP制御](./preview/poison.js)
- [スタイル・アニメーション](./preview/poison.css)
- [比較用の仮盤面](./preview/index.html)

## プレビューの起動

Node.jsとnpmが使える環境で、このリポジトリのルートから実行します。

```sh
npm ci
npx vite docs/hidoime/preview --config docs/hidoime/preview/vite.config.mjs --host localhost --port 5181
```

表示されたローカルURLを開いてください。動きが止まっている場合は「動きを見る」を押します。各色のHPボタンで段階を選択し、0%で消滅、100%に戻して再演できます。

## Claudeへの依頼文

このブランチの docs/hidoime/HIDOIME_HANDOFF.md と docs/hidoime/preview/ を読み、エネミー「ヒドイメ」の引き継ぎ資料として参照してください。実装を依頼された際は、サンプルの見た目・HP別の泡密度・消滅演出を維持し、既存ゲームの構造に合わせてください。未決定のゲーム仕様は勝手に補完しないでください。mainへのマージはまだ行わないでください。
