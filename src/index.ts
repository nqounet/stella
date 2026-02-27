import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const execAsync = promisify(exec);

// APIキーの確認
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite-preview-02-05";

if (!API_KEY || API_KEY === 'your_api_key_here') {
  console.error("エラー: GEMINI_API_KEY が .env ファイルに設定されていません。");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: `
あなたは STELLA (Stateful Turn-based Execution & LLM Loop Architecture) の中核となる頭脳（CPU）です。

【出力ルール】
あなたは「思考内容」「ユーザーへのメッセージ」「ツール実行」を以下のJSON形式でのみ出力してください。
決してJSON以外のテキスト（挨拶、解説、markdownのコードブロック記号など）を含めないでください。

{
  "thought": "現在の状況分析と次に行うべきことの思考プロセス",
  "message": "ユーザーへの回答、要約結果、報告事項（必ずここに詳細を書いてください）",
  "tool": "実行するツール名（不要な場合は空文字 \"\"）",
  "parameters": { "引数名": "値" }
}

【利用可能なツール】
1. run_shell: シェルコマンドを実行します。
   - parameters: { "command": "実行するコマンド" }
2. ask_user: ユーザーに質問したり、追加情報を求めたりします。
   - parameters: { "query": "質問内容" }
3. finish: 全てのタスクが完了し、ユーザーに最終報告を終えたら呼び出します。
   - parameters: {}

【重要】
- あなたの出力はそのままプログラムでパースされます。
- ツールを実行した結果は、次のターンの入力として与えられます。
- message フィールドに情報を詰め込むことを忘れないでください。
`,
});

interface ToolCall {
  thought: string;
  message?: string;
  tool: string;
  parameters: any;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

/**
 * テキストから最初の有効なJSONオブジェクトを抽出する
 */
function extractFirstJsonObject(text: string): any {
  // markdown のコードブロック (```json ... ```) を除去
  const cleaned = text.replace(/```json\n?([\s\S]*?)\n?```/g, '$1').trim();
  
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSONオブジェクトが見つかりませんでした。");
  }
  
  const jsonStr = cleaned.substring(start, end + 1);
  return JSON.parse(jsonStr);
}

async function executeTool(call: ToolCall): Promise<string> {
  console.log();
  if (call.thought) console.log(`🧠 [思考]: ${call.thought}`);
  if (call.message) {
    console.log("--------------------------------------------------");
    console.log(`💬 [STELLA]: ${call.message}`);
    console.log("--------------------------------------------------");
  }
  
  if (!call.tool || call.tool === "" || call.tool === "none") {
    return "No tool executed";
  }

  console.log(`🛠️  [実行]: ${call.tool}`);
  
  try {
    switch (call.tool) {
      case 'run_shell':
        console.log(`   > コマンド: ${call.parameters.command}`);
        const { stdout, stderr } = await execAsync(call.parameters.command);
        const combined = `[stdout]\n${stdout}\n[stderr]\n${stderr}`;
        
        // トレース表示
        const preview = stdout.trim() || stderr.trim();
        if (preview) {
          console.log(`   > 実行結果:\n${preview.split('\n').slice(0, 10).join('\n')}${preview.split('\n').length > 10 ? '\n...' : ''}`);
        } else {
          console.log(`   > (出力なし)`);
        }
        
        return combined;
        
      case 'ask_user':
        console.log();
        const answer = await question(`❓ [Userへの質問]: ${call.parameters.query}\n   回答: `);
        return `[User Answer]: ${answer}`;
        
      case 'finish':
        return "SESSION_FINISHED";
        
      default:
        return `エラー: 未知のツール '${call.tool}' が呼ばれました。`;
    }
  } catch (error: any) {
    console.error(`   ❌ エラー: ${error.message}`);
    return `エラー: 実行中に不具合が発生しました: ${error.message}`;
  }
}

async function startStellaLoop() {
  console.log("==================================================");
  console.log(`🌟 STELLA (${MODEL_NAME}) 起動 🌟`);
  console.log("==================================================");

  const chat = model.startChat({ history: [] });

  let sessionActive = true;
  let nextInput: string = await question("指示を入力してください: ");

  while (sessionActive) {
    try {
      const result = await chat.sendMessage(nextInput);
      const responseText = result.response.text();

      try {
        const call: ToolCall = extractFirstJsonObject(responseText);
        const toolResult = await executeTool(call);

        if (toolResult === "SESSION_FINISHED") {
          console.log();
          console.log("✅ [STELLA] タスク完了。セッションを終了します。");
          sessionActive = false;
        } else {
          nextInput = `ツール実行結果:\n${toolResult}`;
        }
      } catch (parseError: any) {
        console.error(`\n⚠️  [解析エラー]: ${parseError.message}`);
        console.log("--- 生の応答 ---");
        console.log(responseText);
        console.log("----------------");
        nextInput = `エラー: JSONの形式が正しくありませんでした。もう一度、純粋なJSONのみで応答してください。詳細: ${parseError.message}`;
      }

    } catch (e: any) {
      console.error(`\n⚠️  [通信エラー]: ${e.message}`);
      nextInput = `APIとの通信でエラーが発生しました。再試行してください: ${e.message}`;
    }
  }

  rl.close();
}

startStellaLoop().catch(console.error);
