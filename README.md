# 🌟 STELLA

**S**tateful **T**urn-based **E**xecution & **L**LM **L**oop **A**rchitecture

STELLAは、LLM（大規模言語モデル）を単なる「テキスト生成器」ではなく、「自律的に考え、ツールを使い、自ら終了を判断するCPU」として扱うための、ループ駆動型エージェント・アーキテクチャです。

## 特徴

- **Inversion of Control**: プログラムがLLMを呼び出すのではなく、LLMがプログラム（ツール）を呼び出し、タスクの完了を自己決定します。
- **Stateful Loop**: 1つのセッション（1リクエスト）を長時間維持し、試行錯誤と自己修正を繰り返します。
- **Interactive**: 途中で判断に迷った場合は、自らユーザーに質問（`ask_user`）を投げ、対話的に問題を解決します。

## 現在のステータス

現在は**「Human-in-the-loop モック」**のフェーズです。
本物のLLMを接続する前に、人間がLLMのフリをしてJSONを出力することで、制御ループ自体が堅牢に動作するかを検証できます。

## 使い方（モック環境）

```bash
# 依存関係のインストール
npm install

# モックループの起動
npx tsx src/index.ts
```

起動後、以下のようなJSONを入力して、STELLAに指示を出してください。

**シェルコマンドの実行:**
```json
{"tool": "run_shell", "parameters": {"command": "ls -la"}}
```

**ユーザーへの質問:**
```json
{"tool": "ask_user", "parameters": {"query": "次に何をすべきですか？"}}
```

**セッションの終了:**
```json
{"tool": "finish", "parameters": {}}
```

## ロードマップ

1. [x] モックループの作成（イベントループとツール・ディスパッチャーの実装）
2. [ ] Gemini API / OpenAI API SDK の導入と Chat Session の接続
3. [ ] `deba` から Git Worktree などの隔離環境の移植
4. [ ] バッチ・タスクの自律処理テスト

## License
MIT
