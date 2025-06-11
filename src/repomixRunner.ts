import * as vscode from 'vscode';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

/**
 * repomix実行のためのオプション
 */
export interface RepomixOptions {
  // 処理対象のファイルパス（相対パス）
  files: string[];
  // ワークスペースのルートパス
  workspaceRoot: string;
  // 追加オプション（将来的な拡張用）
  additionalOptions?: Record<string, unknown>;
}

/**
 * repomix実行結果
 */
export interface RepomixResult {
  // 実行成功したか
  success: boolean;
  // 出力メッセージ
  output: string;
  // エラーメッセージ（エラーの場合）
  error?: string;
  // 実行時刻
  timestamp: Date;
  // 実行時間（ミリ秒）
  executionTimeMs?: number;
}

/**
 * repomixを実行する
 * 
 * @param options repomixの実行オプション
 * @returns 実行結果
 */
export async function executeRepomix(options: RepomixOptions): Promise<RepomixResult> {
  const startTime = Date.now();
  
  try {
    // 実際にはここでrepomixを実行する
    // 現在はモック実装
    
    // 実際の実装では以下のような形でCLIを呼び出す
    // const cmdArgs = options.files.map(f => `"${f}"`).join(' ');
    // const { stdout, stderr } = await exec(`repomix ${cmdArgs}`, { cwd: options.workspaceRoot });
    
    // モック実装として成功したと想定
    await new Promise(resolve => setTimeout(resolve, 500)); // 処理時間をシミュレート

    const fileDetails = options.files.map(file => {
      return `- ${file} (処理成功)`;
    }).join('\n');
    
    const output = `# Repomix 実行結果
    
## 実行情報

- ワークスペース: ${options.workspaceRoot}
- 処理ファイル数: ${options.files.length}

## 処理されたファイル

${fileDetails}

## 実行結果

すべてのファイルが正常に処理されました。`;

    return {
      success: true,
      output,
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };
  } catch (error) {
    // エラー発生時の処理
    console.error('Repomix execution error:', error);
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * repomixの実行結果をVSCodeエディタに表示する
 * 
 * @param result repomixの実行結果
 */
export async function showRepomixResult(result: RepomixResult): Promise<void> {
  try {
    // 新しいエディタタブを開いて結果を表示
    const document = await vscode.workspace.openTextDocument({
      content: result.success ? result.output : `# Repomix 実行エラー\n\n${result.error}`,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(document);
  } catch (error) {
    vscode.window.showErrorMessage(`結果の表示に失敗しました: ${error}`);
  }
}
