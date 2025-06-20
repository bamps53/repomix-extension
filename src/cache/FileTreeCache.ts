import * as vscode from 'vscode';

/**
 * ディレクトリ選択状態のキャッシュエントリ
 */
interface DirectoryStateCache {
  state: 'none' | 'partial' | 'all';
  timestamp: number;
}

/**
 * ファイル検証結果のキャッシュエントリ
 */
interface FileValidationCache {
  shouldIgnore: boolean;
  isValidSize: boolean;
  timestamp: number;
}

/**
 * ファイルツリーのキャッシュマネージャー
 * パフォーマンス向上のため、計算結果をキャッシュします
 */
export class FileTreeCache {
  private directoryStateCache = new Map<string, DirectoryStateCache>();
  private fileValidationCache = new Map<string, FileValidationCache>();
  private cacheExpirationMs = 60000; // 60秒でキャッシュ期限切れ

  /**
   * ディレクトリの選択状態をキャッシュから取得
   */
  getDirectoryState(uri: vscode.Uri): 'none' | 'partial' | 'all' | undefined {
    const key = uri.toString();
    const cached = this.directoryStateCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return cached.state;
    }
    
    return undefined;
  }

  /**
   * ディレクトリの選択状態をキャッシュに保存
   */
  setDirectoryState(uri: vscode.Uri, state: 'none' | 'partial' | 'all'): void {
    const key = uri.toString();
    this.directoryStateCache.set(key, {
      state,
      timestamp: Date.now()
    });
  }

  /**
   * ファイル検証結果をキャッシュから取得
   */
  getFileValidation(filePath: string): { shouldIgnore: boolean; isValidSize: boolean } | undefined {
    const cached = this.fileValidationCache.get(filePath);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return {
        shouldIgnore: cached.shouldIgnore,
        isValidSize: cached.isValidSize
      };
    }
    
    return undefined;
  }

  /**
   * ファイル検証結果をキャッシュに保存
   */
  setFileValidation(filePath: string, shouldIgnore: boolean, isValidSize: boolean): void {
    this.fileValidationCache.set(filePath, {
      shouldIgnore,
      isValidSize,
      timestamp: Date.now()
    });
  }

  /**
   * 指定されたディレクトリとその子要素のキャッシュを無効化
   */
  invalidateDirectory(uri: vscode.Uri): void {
    const dirPath = uri.toString();
    
    // ディレクトリ自体のキャッシュを削除
    this.directoryStateCache.delete(dirPath);
    
    // 子要素のキャッシュも削除
    for (const [key] of this.directoryStateCache) {
      if (key.startsWith(dirPath)) {
        this.directoryStateCache.delete(key);
      }
    }
    
    // ファイル検証キャッシュも削除
    const fsPath = uri.fsPath;
    for (const [filePath] of this.fileValidationCache) {
      if (filePath.startsWith(fsPath)) {
        this.fileValidationCache.delete(filePath);
      }
    }
  }

  /**
   * 親ディレクトリのキャッシュを無効化（選択状態が変わったため）
   */
  invalidateParentDirectories(uri: vscode.Uri): void {
    let currentUri = uri;
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    
    if (!workspaceUri) {return;}
    
    // ルートディレクトリまで遡って無効化
    while (currentUri.fsPath !== workspaceUri.fsPath) {
      const parentPath = vscode.Uri.file(currentUri.fsPath.substring(0, currentUri.fsPath.lastIndexOf('/')));
      if (parentPath.fsPath === currentUri.fsPath) {break;} // これ以上親がない
      
      this.directoryStateCache.delete(parentPath.toString());
      currentUri = parentPath;
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  clear(): void {
    this.directoryStateCache.clear();
    this.fileValidationCache.clear();
  }

  /**
   * 期限切れのキャッシュエントリを削除
   */
  cleanExpired(): void {
    const now = Date.now();
    
    // ディレクトリ状態キャッシュのクリーンアップ
    for (const [key, value] of this.directoryStateCache) {
      if (now - value.timestamp >= this.cacheExpirationMs) {
        this.directoryStateCache.delete(key);
      }
    }
    
    // ファイル検証キャッシュのクリーンアップ
    for (const [key, value] of this.fileValidationCache) {
      if (now - value.timestamp >= this.cacheExpirationMs) {
        this.fileValidationCache.delete(key);
      }
    }
  }
}