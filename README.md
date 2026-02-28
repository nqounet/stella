<p align="center">
  <img src="assets/logo.png" width="800" alt="STELLA Logo">
</p>

# STELLA

**S**tateful **T**urn-based **E**xecution & **L**LM **L**oop **A**rchitecture

STELLAは、LLM（大規模言語モデル）を単なる「テキスト生成器」ではなく、「自律的に考え、ツールを使い、自ら終了を判断するCPU」として扱うための、ループ駆動型エージェント・アーキテクチャです。

## 特徴

- **Inversion of Control**: プログラムがLLMを呼び出すのではなく、LLMがプログラム（ツール）を呼び出し、タスクの完了を自己決定します。
- **Multi-Provider Support**: Google Gemini, GitHub Models (Azure), OpenAI API をシームレスに切り替えて利用可能です。
- **Stateful Loop**: 1つのセッションを長時間維持し、試行錯誤と自己修正を繰り返します。
- **Interactive**: 途中で判断に迷った場合は、自らユーザーに質問（`ask_user`）を投げ、対話的に問題を解決します。

## 使い方

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して API キーを設定してください
```

### 2. 起動

```bash
# デフォルト（config.tomlの設定）で起動
npm start

# デバッグモード（APIのやり取りを表示）で起動
STELLA_DEBUG=true npm start
```

### 3. 操作

起動後、STELLAに自然言語で指示を出してください。STELLAは必要に応じてツールを使用し、結果を報告します。

**利用可能なツール:**
- `run_shell`: シェルコマンドの実行（ファイル操作、情報収集など）
- `ask_user`: ユーザーへの質問と回答の待機
- `list_models`: 利用可能なモデル一覧の取得
- `switch_model`: モデルやプロバイダーの切り替え（設定は `config.toml` に保存されます）
- `finish`: セッションの終了

## 開発の系譜

STELLAは、自律型エージェントの最小構成（ミニマル・コア）を探求するプロジェクトとして誕生しました。対話型CLIツール開発の強力な雛形として機能します。

## License
MIT
