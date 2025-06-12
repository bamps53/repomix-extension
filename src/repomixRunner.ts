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
    // Convert selected files to include patterns
    // repomix works with directory and include patterns, not individual files
    // The files are already relative paths from extension.ts
    const includePatterns = options.files;
    
    // Build the repomix command with include patterns
    const includeArg = includePatterns.length > 0 
      ? `--include "${includePatterns.join(',')}"` 
      : '';
    
    // Always process the current directory (workspace root)
    const command = `npx repomix ${includeArg} .`;
    
    console.log(`Executing: ${command}`);
    console.log(`Working directory: ${options.workspaceRoot}`);
    console.log(`Include patterns: ${includePatterns.join(', ')}`);
    
    // Execute repomix CLI with selected files
    const { stdout, stderr } = await exec(command, { 
      cwd: options.workspaceRoot,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
    });
    
    // Check for stderr warnings but don't fail on them
    if (stderr && stderr.trim()) {
      console.warn('Repomix stderr output:', stderr);
    }
    
    return {
      success: true,
      output: stdout || 'Repomix executed successfully',
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };
  } catch (error) {
    // Error handling
    console.error('Repomix execution error:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check if repomix command is not found
      if (errorMessage.includes('command not found') || errorMessage.includes('not recognized')) {
        errorMessage = 'repomix command not found. Please ensure repomix is installed via npm (npm install -g repomix) or available as npx repomix.';
      }
    }
    
    return {
      success: false,
      output: '',
      error: errorMessage,
      timestamp: new Date(),
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Open the generated repomix-output.xml file in VS Code editor
 * 
 * @param options repomix execution options containing workspace root
 */
export async function showRepomixResult(options: RepomixOptions): Promise<void> {
  try {
    // repomix-output.xml file path
    const outputFilePath = path.join(options.workspaceRoot, 'repomix-output.xml');
    
    // Check if the file exists
    const outputUri = vscode.Uri.file(outputFilePath);
    
    try {
      // Try to open the generated XML file
      const document = await vscode.workspace.openTextDocument(outputUri);
      await vscode.window.showTextDocument(document);
    } catch (fileError) {
      // If file doesn't exist, show an error message
      vscode.window.showErrorMessage(`repomix-output.xml not found at: ${outputFilePath}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open result file: ${error}`);
  }
}
