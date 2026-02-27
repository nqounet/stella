import * as readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import TOML from '@iarna/toml';

dotenv.config();
const execAsync = promisify(exec);

const SYSTEM_INSTRUCTION = `
あなたは STELLA (Stateful Turn-based Execution & LLM Loop Architecture) の中核となる頭脳（CPU）です。
あなたは「永続的なアシスタント」であり、一つのタスクが終わっても勝手にセッションを終了（finish）せず、報告の後に次の指示を待つのが基本スタイルです。

【出力ルール】
あなたは「思考内容」「ユーザーへのメッセージ」「ツール実行」を以下のJSON形式でのみ出力してください。
決してJSON以外のテキストを含めないでください。

{
  "thought": "現在の状況分析と次に行うべきことの思考プロセス",
  "message": "ユーザーへの回答、要約結果、報告事項",
  "tool": "実行するツール名（不要な場合は空文字 \"\"）",
  "parameters": { "引数名": "値" }
}

【利用可能なツール】
1. run_shell: シェルコマンドを実行します。
2. ask_user: ユーザーに質問します。
3. list_models: モデル一覧を取得します。
4. switch_model: { "model_name": "...", "provider": "google|github|openai" } で設定を変更します。
5. finish: アプリを終了します。
`;

interface ChatSession {
  sendMessage(input: string): Promise<string>;
}

class GeminiChatSession implements ChatSession {
  private chat: any;
  constructor(apiKey: string, modelName: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_INSTRUCTION });
    this.chat = model.startChat({ history: [] });
  }
  async sendMessage(input: string): Promise<string> {
    const res = await this.chat.sendMessage(input);
    return res.response.text();
  }
}

class OpenAIChatSession implements ChatSession {
  private client: OpenAI; private modelName: string; private history: any[] = [];
  constructor(apiKey: string, modelName: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.modelName = modelName;
    this.history.push({ role: 'system', content: SYSTEM_INSTRUCTION });
  }
  async sendMessage(input: string): Promise<string> {
    this.history.push({ role: 'user', content: input });
    const res = await this.client.chat.completions.create({
      model: this.modelName, messages: this.history, response_format: { type: "json_object" }
    });
    const text = res.choices[0].message.content || "{}";
    this.history.push({ role: 'assistant', content: text });
    return text;
  }
}

const CONFIG_PATH = path.join(process.cwd(), 'config.toml');
let config: any = { model_name: "gemini-2.0-flash-lite-preview-02-05", provider: "google" };
if (fs.existsSync(CONFIG_PATH)) config = { ...config, ...TOML.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };

const DEBUG = process.env.STELLA_DEBUG === 'true';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (msg: string): Promise<string> => new Promise(r => rl.question(msg, r));

  let session: ChatSession;
  try {
    if (config.provider === "google") {
      session = new GeminiChatSession(process.env.GEMINI_API_KEY || "", config.model_name);
    } else if (config.provider === "github") {
      session = new OpenAIChatSession(process.env.GITHUB_TOKEN || "", config.model_name, "https://models.inference.ai.azure.com");
    } else if (config.provider === "openai") {
      session = new OpenAIChatSession(process.env.OPENAI_API_KEY || "", config.model_name); // Default is OpenAI API
    } else {
      throw new Error(`未知のプロバイダー: ${config.provider}`);
    }
  } catch (e: any) {
    console.error("起動エラー:", e.message); process.exit(1);
  }

  console.log(`🌟 STELLA (${config.model_name} / ${config.provider}) 起動`);
  let nextInput: string = await q("指示を入力してください: ");

  while (true) {
    try {
      if (DEBUG) {
        console.log("\n--- [DEBUG] API Request ---");
        console.log(nextInput);
        console.log("---------------------------\n");
      }

      const respText = await session.sendMessage(nextInput);

      if (DEBUG) {
        console.log("\n--- [DEBUG] API Response ---");
        console.log(respText);
        console.log("----------------------------\n");
      }

      const call = JSON.parse(respText.substring(respText.indexOf('{'), respText.lastIndexOf('}') + 1));

      if (call.thought) console.log(`🧠 [思考]: ${call.thought}`);
      if (call.message) console.log(`------------------\n💬 [STELLA]: ${call.message}\n------------------`);
      if (!call.tool) { nextInput = await q("次は何をしますか？: "); continue; }

      console.log(`🛠️ [実行]: ${call.tool}`);
      let result = "";
      switch (call.tool) {
        case 'run_shell':
          const { stdout, stderr } = await execAsync(call.parameters.command);
          const out = stdout.trim() || stderr.trim();
          if (out) console.log(`   > 実行結果(一部):\n${out.split('\n').slice(0, 5).join('\n')}${out.split('\n').length > 5 ? '\n...' : ''}`);
          result = `[stdout]\n${stdout}\n[stderr]\n${stderr}`;
          break;
        case 'ask_user':
          result = `[User Answer]: ${await q(`❓ ${call.parameters.query}\n回答: `)}`;
          break;
        case 'switch_model':
          config = { ...config, ...call.parameters };
          fs.writeFileSync(CONFIG_PATH, TOML.stringify(config));
          console.log("✅ 設定を保存しました。再起動が必要です。");
          process.exit(0);
        case 'list_models':
          if (config.provider === "google") {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
            const data = await resp.json() as any;
            result = `Gemini models: ${data.models.map((m: any) => m.name.replace("models/", "")).join(", ")}`;
          } else {
            try {
              const res = await fetch("https://models.inference.ai.azure.com/models", {
                headers: { "Authorization": `Bearer ${process.env.GITHUB_TOKEN}` }
              });
              const data = await res.json() as any[];
              const modelIds = data.map(m => m.name);
              result = `GitHub Models: ${modelIds.join(", ")}`;
            } catch (e: any) {
              result = `GitHub Models の取得に失敗しました: ${e.message}`;
            }
          }
          break;
        case 'finish': process.exit(0);
        default: result = "未知のツール";
      }
      nextInput = `ツール実行結果:\n${result}`;
    } catch (e: any) {
      console.error("❌ Error:", e.message);
      nextInput = `エラーが発生しました: ${e.message}. 再試行してください。`;
    }
  }
}
main().catch(console.error);
