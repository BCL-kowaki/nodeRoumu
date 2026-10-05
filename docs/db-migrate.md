# データベース変更の手順（Prisma Migrate）

2026-10 に `prisma db push`（変更履歴なし）から `prisma migrate`（変更履歴あり）へ切り替えた。
`prisma/migrations/0_init` は切り替え時点の本番スキーマそのもの（ベースライン）。

## 初回だけ：本番DBにベースラインを記録する

本番DBはすでに `0_init` と同じ形になっているため、「適用済み」として記録だけ行う。
**次にスキーマを変更して本番に出す前に、必ず1回実行すること。**

```bash
# 1. 本番の接続先を手元に取得（.env*.local は .gitignore 済み。Vercel にログインが必要）
npx vercel env pull .env.production.local --environment=production

# 2. 取得した値をこのターミナルだけで読み込む
set -a; source .env.production.local; set +a

# 3. 本番DBと schema.prisma に差分が無いことを確認（"No difference detected." なら OK）
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma

# 4. ベースラインを適用済みとして記録（テーブルは変更されない）
npx prisma migrate resolve --applied 0_init

# 5. 本番の接続先ファイルを削除する
rm .env.production.local
```

差分が出た場合は、本番DBが schema.prisma とずれている。記録せずに相談すること。

## 普段のスキーマ変更

1. `prisma/schema.prisma` を編集する
2. 開発DBで変更履歴を作る: `npm run db:migrate -- --name 変更内容`
3. 生成された `prisma/migrations/<日時>_<名前>/migration.sql` を確認してコミット
4. 本番へ反映するときは、デプロイ前に本番DBへ適用する: `npm run db:deploy`（本番の DATABASE_URL で実行）

## 注意

- ビルド時（Vercel）に自動で `migrate deploy` は実行しない。
  プレビュー環境が本番DBを共有している場合、未レビューのブランチの変更が本番DBに入ってしまうため。
- 本番で `prisma db push` や `prisma migrate dev` / `migrate reset` は使わない（データが消える場合がある）。
- 列の削除・型変更など破壊的な変更は、事前にバックアップを取り、`database-reviewer` でレビューする。
