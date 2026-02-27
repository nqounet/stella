# AGENTS.md

このリポジトリは、対話型エージェントである **STELLA (Stateful Turn-based Execution & LLM Loop Architecture)** のコア実装を管理しています。

## リポジトリの目的

STELLAは、LLM (Large Language Model) を「自律的なCPU」として扱い、ユーザーの指示に基づきシェルコマンドの実行、ツールの利用、および情報収集を行うことを目的とした **ミニマル・エージェント・コア** です。

## 主要な技術スタック

-   **言語**: TypeScript
-   **ランタイム**: Node.js
-   **LLM API**: Google Gemini, GitHub Models, OpenAI API
-   **タスクランナー/環境管理**: mise

## ファイル構造の概要

-   `.env`, `.env.example`: 環境変数の設定。APIキーなどの機密情報を管理します。
-   `config.toml`: STELLAの動作設定（利用モデル、プロバイダー）を定義。実行中に `switch_model` ツールで更新可能です。
-   `mise.toml`: `mise` を利用したタスク定義。
-   `src/index.ts`: STELLAのメイン・イベントループおよびツール・ディスパッチャーの実装。
-   `CONCEPT.md`: STELLAの設計思想、主従関係の逆転（Inversion of Control）について記述。
-   `README.md`: セットアップ、起動方法、利用可能なツールの解説。
-   `THANKS.md`: 本プロジェクトに関わったすべての協力者への感謝。

## STELLAの挙動

STELLAは、以下のサイクルで動作します。

1.  **指示の受領**: ユーザーまたは自身の思考から次のステップを決定。
2.  **ツール実行**: `run_shell` (シェル操作), `ask_user` (対話), `list_models` (モデル一覧取得) などのツールを自ら呼び出し。
3.  **状態保持**: セッションが終了するまでコンテキスト（思考プロセスと実行結果）を保持し、再試行や自己修正を実行。

### 起動コマンド

```bash
# 標準起動
mise run stella

# デバッグ起動（APIのペイロードを表示）
mise run debug
```

---
*This document is the final architectural snapshot of the STELLA project.*
