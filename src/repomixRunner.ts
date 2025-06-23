import * as vscode from 'vscode';
import * as path from 'path';
import * as childProcess from 'child_process';

// Output Channel for repomix logs
let outputChannel: vscode.OutputChannel | undefined;

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
  // Create output channel if not exists
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Repomix');
  }
  
  // Clear previous logs and show new execution
  outputChannel.clear();
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine(`Repomix Execution Started at ${new Date().toLocaleString()}`);
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine('');
  const startTime = Date.now();
  
  try {
    // Convert selected files to include patterns
    // repomix works with directory and include patterns, not individual files
    // The files are already relative paths from extension.ts
    const includePatterns = options.files;
    
    // Build the repomix command arguments
    const args: string[] = ['repomix'];
    if (includePatterns.length > 0) {
      args.push('--include', includePatterns.join(','));
    }
    args.push('.');
    
    // Log command details
    const commandDisplay = `npx ${args.join(' ')}`;
    outputChannel.appendLine('Command Details:');
    outputChannel.appendLine(`  Command: ${commandDisplay}`);
    outputChannel.appendLine(`  Working Directory: ${options.workspaceRoot}`);
    outputChannel.appendLine(`  Include Patterns: ${includePatterns.join(', ')}`);
    outputChannel.appendLine(`  Total Files: ${includePatterns.length}`);
    outputChannel.appendLine('');
    outputChannel.appendLine('Execution Output:');
    outputChannel.appendLine('-'.repeat(40));
    
    // Execute repomix using spawn which doesn't require a shell
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const npxProcess = childProcess.spawn('npx', args, {
        cwd: options.workspaceRoot,
        env: process.env
      });
      
      let stdout = '';
      let stderr = '';
      
      npxProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        outputChannel?.append(chunk);
      });
      
      npxProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
      });
      
      npxProcess.on('error', (error) => {
        reject(error);
      });
      
      npxProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });
    });
    
    // Log stdout is already done in real-time above
    
    // Check for stderr warnings but don't fail on them
    if (result.stderr && result.stderr.trim()) {
      outputChannel.appendLine('');
      outputChannel.appendLine('Warnings/Errors:');
      outputChannel.appendLine(result.stderr);
    }
    
    const executionTime = Date.now() - startTime;
    outputChannel.appendLine('');
    outputChannel.appendLine('-'.repeat(40));
    outputChannel.appendLine(`✅ Execution completed successfully`);
    outputChannel.appendLine(`⏱️  Execution time: ${executionTime}ms`);
    outputChannel.appendLine(`📁 Output file: repomix-output.xml`);
    
    return {
      success: true,
      output: result.stdout || 'Repomix executed successfully',
      timestamp: new Date(),
      executionTimeMs: executionTime
    };
  } catch (error) {
    // Error handling
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check if repomix command is not found
      if (errorMessage.includes('command not found') || errorMessage.includes('not recognized')) {
        errorMessage = 'repomix command not found. Please ensure repomix is installed via npm (npm install -g repomix) or available as npx repomix.';
      }
    }
    
    // Log error details
    outputChannel.appendLine('');
    outputChannel.appendLine('-'.repeat(40));
    outputChannel.appendLine(`❌ Execution failed`);
    outputChannel.appendLine(`Error: ${errorMessage}`);
    outputChannel.appendLine(`⏱️  Execution time: ${Date.now() - startTime}ms`);
    
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
 * Get the output channel for showing logs
 * 
 * @returns The output channel instance
 */
export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Repomix');
  }
  return outputChannel;
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
