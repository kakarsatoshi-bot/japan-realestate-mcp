# japan-realestate-mcp

MCP (Model Context Protocol) server exposing Japan's official real estate transaction data (MLIT Real Estate Information Library API), deployed on Cloudflare Workers. Part of the "Japan Data" MCP series sold on Smithery/Gumroad/Zenn.

## セッション終わりの記録ルール（2026-07-29策定）

このリポジトリはセッション頻度が低い単機能MCPサーバーなので、大掛かりな引き継ぎ書は不要。以下の原則だけ守る。

- 作業が途中で終わる場合は、セッションの終わりに「今どこまで進んだか・次に何をやるか」を短く書き残す（このCLAUDE.mdの末尾やPR/コミットメッセージに数行でよい）。次のセッションがそれを読めばすぐ再開できるようにする。
- 変更履歴を残すchangelog/引き継ぎ書がこのリポジトリに存在する場合のみ、ワークフロー・スキーマ・デプロイ設定など仕組みに影響する変更を追記する。存在しない場合は無理に作らず、この項目は省略してよい。記事内容やデータ更新のような日常的な変更は対象外。
