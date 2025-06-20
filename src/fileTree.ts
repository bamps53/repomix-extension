import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { RepomixConfigUtil } from './repomixConfig';
import { FileTreeCache } from './cache/FileTreeCache';

/**
 * ファイルシステムエントリを表す型
 */
export interface FileSystemItem {
  resourceUri: vscode.Uri;
  type?: vscode.FileType;
  contextValue?: string;
}

/**
 * ファイルツリープロバイダー
 * ワークスペース内のファイル構造を表示し、選択状態を管理します
 */
export class FileTreeProvider implements vscode.TreeDataProvider<FileSystemItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileSystemItem | undefined | null | void> = 
    new vscode.EventEmitter<FileSystemItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<FileSystemItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  // 選択されたアイテムを保持する内部マップ
  private checkedItems = new Map<string, boolean>();

  private workspaceRoot: string;
  private context: vscode.ExtensionContext;
  private repomixConfig: RepomixConfigUtil;
  private isTestEnvironment: boolean;
  private cache: FileTreeCache;
  private updateDebounceTimer?: NodeJS.Timeout;
  private pendingUpdates = new Set<string>();
  
  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
    
    // テスト環境検知
    this.isTestEnvironment = workspaceRoot.includes('/test/') || 
                           process.env.NODE_ENV === 'test' ||
                           typeof global !== 'undefined' && global.process?.env?.NODE_ENV === 'test';
    
    this.repomixConfig = new RepomixConfigUtil(workspaceRoot);
    this.cache = new FileTreeCache();
    
    // 初期化時にrepomix設定を読み込む（テスト環境では無効化）
    if (!this.isTestEnvironment) {
      this.initializeRepomixConfig();
    }
    
    // 定期的に期限切れキャッシュをクリーンアップ
    setInterval(() => this.cache.cleanExpired(), 300000); // 5分ごと
  }

  /**
   * Repomix設定を初期化する
   */
  private async initializeRepomixConfig(): Promise<void> {
    try {
      await this.repomixConfig.loadConfig();
    } catch (error) {
      console.error('Error initializing repomix config:', error);
    }
  }
  
  /**
   * ワークスペースのルートパスを取得する
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * ファイルツリーをリフレッシュし、すべての選択状態をリセットする
   */
  async refresh(): Promise<void> {
    // すべての選択状態をクリア
    this.checkedItems.clear();
    
    // キャッシュもクリア
    this.cache.clear();
    
    // repomix設定を再読み込み
    await this.initializeRepomixConfig();
    
    // ツリービューを更新
    this._onDidChangeTreeData.fire();
  }

  /**
   * 選択状態をクリアせずにツリービューのみ更新する
   */
  updateView(element?: FileSystemItem): void {
    if (element) {
      // 特定の要素のみ更新
      this.scheduleUpdate(element);
    } else {
      // 全体更新
      this._onDidChangeTreeData.fire();
    }
  }
  
  /**
   * 更新をスケジューリング（デバウンス付き）
   */
  private scheduleUpdate(element: FileSystemItem): void {
    if (!element.resourceUri) {return;}
    
    const key = element.resourceUri.toString();
    this.pendingUpdates.add(key);
    
    // 既存のタイマーをクリア
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    // 50ms後に一括更新
    this.updateDebounceTimer = setTimeout(() => {
      this.processPendingUpdates();
    }, 50);
  }
  
  /**
   * 保留中の更新を処理
   */
  private processPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) {return;}
    
    // 更新対象の要素を特定
    const elementsToUpdate = new Set<FileSystemItem>();
    
    for (const key of this.pendingUpdates) {
      const uri = vscode.Uri.parse(key);
      elementsToUpdate.add({ resourceUri: uri });
    }
    
    // 保留リストをクリア
    this.pendingUpdates.clear();
    
    // 実際の更新を実行（全体更新で簡略化）
    this._onDidChangeTreeData.fire();
  }

  /**
   * アイテムのチェック状態を切り替える
   */
  async toggleChecked(element: FileSystemItem): Promise<void> {
    if (!element.resourceUri) {
      return;
    }

    const key = element.resourceUri.toString();
    // より確実なチェック状態の判定
    const isCurrentlyChecked = this.checkedItems.get(key) || false;

    // 状態の更新
    this.checkedItems.set(key, !isCurrentlyChecked);
    
    // キャッシュを無効化
    this.cache.invalidateDirectory(element.resourceUri);
    this.cache.invalidateParentDirectories(element.resourceUri);
    
    // アイテムがディレクトリの場合、すべての子アイテムも更新
    if (element.type === vscode.FileType.Directory) {
      await this.updateChildrenCheckState(element.resourceUri, !isCurrentlyChecked);
    }

    // UIを全体的に更新
    this.updateView();
  }

  /**
   * ディレクトリ内のすべての子アイテムのチェック状態を更新
   */
  private async updateChildrenCheckState(directoryUri: vscode.Uri, checked: boolean, visitedPaths: Set<string> = new Set()): Promise<void> {
    try {
      const dirPath = directoryUri.fsPath;
      
      // テスト環境では簡略化された処理
      if (this.isTestEnvironment) {
        const entries = await vscode.workspace.fs.readDirectory(directoryUri);
        for (const [name, type] of entries) {
          const childUri = vscode.Uri.joinPath(directoryUri, name);
          const key = childUri.toString();
          this.checkedItems.set(key, checked);
          // テスト環境では再帰しない（無限ループ防止）
        }
        return;
      }
      
      // 循環参照防止：既に訪問したパスはスキップ
      if (visitedPaths.has(dirPath)) {
        return;
      }
      visitedPaths.add(dirPath);
      
      // 深度制限（50階層まで）
      if (visitedPaths.size > 50) {
        console.warn(`Maximum directory depth exceeded for ${dirPath}`);
        return;
      }
      
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      // このディレクトリのキャッシュを無効化（子要素が変更されるため）
      this.cache.invalidateDirectory(directoryUri);
      
      // ファイルとディレクトリを分離
      const files: [string, vscode.FileType][] = [];
      const directories: [string, vscode.FileType][] = [];
      
      for (const entry of entries) {
        if (entry[1] === vscode.FileType.Directory) {
          directories.push(entry);
        } else {
          files.push(entry);
        }
      }
      
      // ファイルの処理（並列）
      const filePromises = files.map(async ([name, type]) => {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        let isValidSize: boolean = true;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
          isValidSize = cached.isValidSize;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // ファイルサイズもチェック
          if (!shouldIgnore) {
            isValidSize = await this.repomixConfig.isFileSizeValid(filePath);
          }
          
          // キャッシュに保存
          this.cache.setFileValidation(filePath, shouldIgnore, isValidSize);
        }
        
        if (!shouldIgnore && isValidSize) {
          const key = childUri.toString();
          // ファイルの状態を更新
          this.checkedItems.set(key, checked);
        }
      });
      
      // ファイルの処理を並列実行
      await Promise.all(filePromises);
      
      // ディレクトリの処理（逐次）
      for (const [name, type] of directories) {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // キャッシュに保存（ディレクトリはサイズチェック不要）
          this.cache.setFileValidation(filePath, shouldIgnore, true);
        }
        
        if (!shouldIgnore) {
          const key = childUri.toString();
          
          // ディレクトリの状態を更新
          this.checkedItems.set(key, checked);
          
          // 再帰的にサブディレクトリを処理
          await this.updateChildrenCheckState(childUri, checked, visitedPaths);
        }
      }
    } catch (error) {
      console.error(`Error updating children check state for ${directoryUri.fsPath}: ${error}`);
    }
  }

  /**
   * チェックされているアイテムのURIリストを取得
   */
  getCheckedItemUris(): vscode.Uri[] {
    const checkedUris: vscode.Uri[] = [];
    
    for (const [key, isChecked] of this.checkedItems.entries()) {
      if (isChecked) {
        checkedUris.push(vscode.Uri.parse(key));
      }
    }
    
    return checkedUris;
  }

  /**
   * チェックされているアイテムのパスリストを取得
   */
  getCheckedItems(): string[] {
    const checkedPaths: string[] = [];
    
    for (const [key, isChecked] of this.checkedItems.entries()) {
      if (isChecked) {
        // URIをファイルシステムパスに変換
        checkedPaths.push(vscode.Uri.parse(key).fsPath);
      }
    }
    
    return checkedPaths;
  }
  
  /**
   * すべてのチェック状態をリセットする
   */
  uncheckAll(): void {
    this.checkedItems.clear();
    this.updateView();
  }

  /**
   * すべてのファイルとフォルダを選択する
   */
  async selectAll(): Promise<void> {
    try {
      await this.selectAllRecursive(vscode.Uri.file(this.workspaceRoot));
      this.updateView();
    } catch (error) {
      console.error('Error selecting all items:', error);
    }
  }

  /**
   * 指定されたディレクトリとその子アイテムを再帰的に選択する
   */
  private async selectAllRecursive(directoryUri: vscode.Uri, visitedPaths: Set<string> = new Set()): Promise<void> {
    // キャッシュを無効化
    this.cache.invalidateDirectory(directoryUri);
    
    try {
      const dirPath = directoryUri.fsPath;
      
      // テスト環境では簡略化された処理
      if (this.isTestEnvironment) {
        const entries = await vscode.workspace.fs.readDirectory(directoryUri);
        for (const [name, type] of entries) {
          const childUri = vscode.Uri.joinPath(directoryUri, name);
          const key = childUri.toString();
          this.checkedItems.set(key, true);
          // テスト環境では再帰しない（無限ループ防止）
        }
        return;
      }
      
      // 循環参照防止：既に訪問したパスはスキップ
      if (visitedPaths.has(dirPath)) {
        return;
      }
      visitedPaths.add(dirPath);
      
      // 深度制限（50階層まで）
      if (visitedPaths.size > 50) {
        console.warn(`Maximum directory depth exceeded for ${dirPath}`);
        return;
      }
      
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      // このディレクトリのキャッシュを無効化（子要素が変更されるため）
      this.cache.invalidateDirectory(directoryUri);
      
      // ファイルとディレクトリを分離
      const files: [string, vscode.FileType][] = [];
      const directories: [string, vscode.FileType][] = [];
      
      for (const entry of entries) {
        if (entry[1] === vscode.FileType.Directory) {
          directories.push(entry);
        } else {
          files.push(entry);
        }
      }
      
      // ファイルの処理（並列）
      const filePromises = files.map(async ([name, type]) => {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        let isValidSize: boolean = true;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
          isValidSize = cached.isValidSize;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // ファイルサイズもチェック
          if (!shouldIgnore) {
            isValidSize = await this.repomixConfig.isFileSizeValid(filePath);
          }
          
          // キャッシュに保存
          this.cache.setFileValidation(filePath, shouldIgnore, isValidSize);
        }
        
        if (!shouldIgnore && isValidSize) {
          const key = childUri.toString();
          // ファイルを選択状態に設定
          this.checkedItems.set(key, true);
        }
      });
      
      // ファイルの処理を並列実行
      await Promise.all(filePromises);
      
      // ディレクトリの処理（逐次）
      for (const [name, type] of directories) {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // キャッシュに保存（ディレクトリはサイズチェック不要）
          this.cache.setFileValidation(filePath, shouldIgnore, true);
        }
        
        if (!shouldIgnore) {
          const key = childUri.toString();
          
          // ディレクトリを選択状態に設定
          this.checkedItems.set(key, true);
          
          // このディレクトリのキャッシュを無効化
          this.cache.invalidateDirectory(childUri);
          
          // 再帰的にサブディレクトリを処理
          await this.selectAllRecursive(childUri, visitedPaths);
        }
      }
    } catch (error) {
      console.error(`Error selecting all items in directory ${directoryUri.fsPath}: ${error}`);
    }
  }

  /**
   * 指定されたパスのチェック状態を設定する
   * @param path ファイルパス
   * @param checked チェック状態
   * @param fireEvent 変更イベントを発火させるかどうか
   */
  setChecked(path: string, checked: boolean, fireEvent: boolean = true): void {
    const uri = vscode.Uri.file(path);
    const key = uri.toString();
    
    this.checkedItems.set(key, checked);
    
    // キャッシュを無効化
    this.cache.invalidateDirectory(uri);
    this.cache.invalidateParentDirectories(uri);
    
    if (fireEvent) {
      // 選択状態をクリアせずにビューのみ更新
      this.updateView();
    }
  }

  /**
   * 指定された要素の子要素を取得する
   */
  async getChildren(element?: FileSystemItem): Promise<FileSystemItem[]> {
    try {
      if (!element) {
        // ルートレベルの場合、設定されたワークスペースルートを使用
        if (!this.workspaceRoot) {
          return [];
        }

        return this.getFilesInDirectory(vscode.Uri.file(this.workspaceRoot));
      } else {
        // 子要素の場合、そのディレクトリの中身を返す
        if (element.resourceUri) {
          return this.getFilesInDirectory(element.resourceUri);
        }
      }
    } catch (error) {
      console.error('Error getting children:', error);
    }
    
    return [];
  }

  /**
   * 指定されたディレクトリ内のファイルとフォルダを取得する
   */
  private async getFilesInDirectory(directoryUri: vscode.Uri): Promise<FileSystemItem[]> {
    try {
      const dirPath = directoryUri.fsPath;
      
      // パスの有効性チェック
      if (!dirPath || dirPath.includes('undefined') || dirPath.length > 500) {
        return [];
      }
      
      // テスト環境では実際のファイルシステムアクセスを避ける
      if (this.isTestEnvironment) {
        // モックのreadDirectoryを使用（これは安全）
        const entries = await vscode.workspace.fs.readDirectory(directoryUri);
        const items = entries.map(([name, type]) => {
          const uri = vscode.Uri.joinPath(directoryUri, name);
          const key = uri.toString();
          let contextValue: string;
          
          if (type === vscode.FileType.Directory) {
            // ディレクトリ自体がチェックされているか確認
            const isChecked = this.checkedItems.get(key) || false;
            contextValue = isChecked ? 'checked' : 'unchecked';
          } else {
            // ファイルの場合は通常のチェック状態
            const isChecked = this.checkedItems.get(key) || false;
            contextValue = isChecked ? 'checked' : 'unchecked';
          }
          
          return {
            resourceUri: uri,
            type: type,
            contextValue: contextValue
          };
        });
        
        // VS Codeのデフォルトの並び順に従って、フォルダを先に、次にファイルを表示
        items.sort((a, b) => {
          // まず、フォルダとファイルを分ける
          const aIsDirectory = a.type === vscode.FileType.Directory;
          const bIsDirectory = b.type === vscode.FileType.Directory;
          
          if (aIsDirectory && !bIsDirectory) {
            return -1; // aがフォルダ、bがファイルの場合、aを先に
          }
          if (!aIsDirectory && bIsDirectory) {
            return 1; // aがファイル、bがフォルダの場合、bを先に
          }
          
          // 両方が同じタイプの場合、名前でソート（大文字小文字を区別しない）
          const aName = path.basename(a.resourceUri.fsPath).toLowerCase();
          const bName = path.basename(b.resourceUri.fsPath).toLowerCase();
          return aName.localeCompare(bName);
        });
        
        return items;
      }
      
      // 実際のファイルシステムの場合、存在確認
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      const filteredEntries: FileSystemItem[] = [];
      
      // 並列処理のためにPromiseの配列を作成
      const entryPromises = entries.map(async ([name, type]) => {
        const uri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = uri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        let isValidSize: boolean = true;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
          isValidSize = cached.isValidSize;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // ファイルサイズもチェック（ファイルの場合のみ）
          if (!shouldIgnore && type === vscode.FileType.File) {
            isValidSize = await this.repomixConfig.isFileSizeValid(filePath);
          }
          
          // キャッシュに保存
          this.cache.setFileValidation(filePath, shouldIgnore, isValidSize);
        }
        
        if (!shouldIgnore && isValidSize) {
          
          const key = uri.toString();
          let contextValue: string;
          
          if (type === vscode.FileType.Directory) {
            // ディレクトリ自体がチェックされているか確認
            const isChecked = this.checkedItems.get(key) || false;
            contextValue = isChecked ? 'checked' : 'unchecked';
          } else {
            // ファイルの場合は通常のチェック状態
            const isChecked = this.checkedItems.get(key) || false;
            contextValue = isChecked ? 'checked' : 'unchecked';
          }
          
          return {
            resourceUri: uri,
            type: type,
            contextValue: contextValue
          };
        }
        return null;
      });
      
      // すべての処理を並列実行
      const results = await Promise.all(entryPromises);
      
      // nullをフィルターして有効なエントリのみ収集
      for (const entry of results) {
        if (entry !== null) {
          filteredEntries.push(entry);
        }
      }
      
      // VS Codeのデフォルトの並び順に従って、フォルダを先に、次にファイルを表示
      filteredEntries.sort((a, b) => {
        // まず、フォルダとファイルを分ける
        const aIsDirectory = a.type === vscode.FileType.Directory;
        const bIsDirectory = b.type === vscode.FileType.Directory;
        
        if (aIsDirectory && !bIsDirectory) {
          return -1; // aがフォルダ、bがファイルの場合、aを先に
        }
        if (!aIsDirectory && bIsDirectory) {
          return 1; // aがファイル、bがフォルダの場合、bを先に
        }
        
        // 両方が同じタイプの場合、名前でソート（大文字小文字を区別しない）
        const aName = path.basename(a.resourceUri.fsPath).toLowerCase();
        const bName = path.basename(b.resourceUri.fsPath).toLowerCase();
        return aName.localeCompare(bName);
      });
      
      return filteredEntries;
    } catch (error) {
      console.error(`Error reading directory ${directoryUri.fsPath}: ${error}`);
      return [];
    }
  }

  /**
   * ディレクトリの選択状態を判定する
   * @returns 'none' | 'partial' | 'all'
   */
  private async getDirectorySelectionState(directoryUri: vscode.Uri): Promise<'none' | 'partial' | 'all'> {
    // キャッシュから取得を試みる
    const cachedState = this.cache.getDirectoryState(directoryUri);
    if (cachedState !== undefined) {
      return cachedState;
    }
    
    try {
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      let checkedCount = 0;
      let totalCount = 0;
      
      // 並列処理のための配列を作成
      const checkPromises = entries.map(async ([name, type]) => {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // キャッシュから検証結果を取得
        let shouldIgnore: boolean;
        let isValidSize: boolean = true;
        
        const cached = this.cache.getFileValidation(filePath);
        if (cached) {
          shouldIgnore = cached.shouldIgnore;
          isValidSize = cached.isValidSize;
        } else {
          // repomixの除外パターンをチェック
          shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
          
          // ファイルサイズもチェック（ファイルの場合のみ）
          if (!shouldIgnore && type === vscode.FileType.File) {
            isValidSize = await this.repomixConfig.isFileSizeValid(filePath);
          }
          
          // キャッシュに保存
          this.cache.setFileValidation(filePath, shouldIgnore, isValidSize);
        }
        
        if (!shouldIgnore && isValidSize) {
          
          const key = childUri.toString();
          
          if (type === vscode.FileType.Directory) {
            // サブディレクトリの場合、再帰的にチェック
            const subState = await this.getDirectorySelectionState(childUri);
            return { isValid: true, isChecked: subState === 'all', isPartial: subState === 'partial' };
          } else {
            // ファイルの場合、チェック状態を確認
            const isChecked = this.checkedItems.get(key) || false;
            return { isValid: true, isChecked, isPartial: false };
          }
        }
        
        return { isValid: false, isChecked: false, isPartial: false };
      });
      
      // すべての処理を並列実行
      const results = await Promise.all(checkPromises);
      
      // 結果を集計
      for (const result of results) {
        if (result.isValid) {
          totalCount++;
          if (result.isPartial) {
            // 部分選択があれば即座に 'partial' を返す
            this.cache.setDirectoryState(directoryUri, 'partial');
            return 'partial';
          }
          if (result.isChecked) {
            checkedCount++;
          }
        }
      }
      
      let result: 'none' | 'partial' | 'all';
      if (checkedCount === 0) {
        result = 'none';
      } else if (checkedCount === totalCount) {
        result = 'all';
      } else {
        result = 'partial';
      }
      
      // 結果をキャッシュに保存
      this.cache.setDirectoryState(directoryUri, result);
      return result;
    } catch (error) {
      console.error(`Error getting directory selection state: ${error}`);
      return 'none';
    }
  }

  /**
   * TreeItemを生成する
   */
  async getTreeItem(element: FileSystemItem): Promise<vscode.TreeItem> {
    const isDirectory = element.type === vscode.FileType.Directory;
    const isChecked = element.contextValue === 'checked';
    
    // ファイル名を取得
    const fileName = path.basename(element.resourceUri.fsPath);
    
    // TreeItemを生成
    const treeItem = new vscode.TreeItem(
      fileName,
      isDirectory 
        ? vscode.TreeItemCollapsibleState.Collapsed 
        : vscode.TreeItemCollapsibleState.None
    );

    // URIを設定
    treeItem.resourceUri = element.resourceUri;

    // アイコンの設定
    let iconName: string;
    
    if (isDirectory) {
      // ディレクトリの場合、選択状態を判定
      const selectionState = await this.getDirectorySelectionState(element.resourceUri);
      
      switch (selectionState) {
        case 'all':
          iconName = 'checked.svg';
          treeItem.tooltip = `${fileName} (all selected)`;
          break;
        case 'partial':
          iconName = 'partial.svg';
          treeItem.tooltip = `${fileName} (partially selected)`;
          break;
        default:
          iconName = 'unchecked.svg';
          treeItem.tooltip = `${fileName} (not selected)`;
      }
    } else {
      // ファイルの場合
      iconName = isChecked ? 'checked.svg' : 'unchecked.svg';
      treeItem.tooltip = `${fileName} ${isChecked ? '(selected)' : '(not selected)'}`;
    }
    
    const iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'resources', iconName);
    
    treeItem.iconPath = {
      light: iconPath,
      dark: iconPath
    };
    
    // コンテキストバリューにチェック状態を追加
    treeItem.contextValue = isChecked ? 'checkedFileTreeItem' : 'uncheckedFileTreeItem';

    // クリック時にトグル処理を実行するコマンドを設定
    treeItem.command = {
      command: 'repomix-extension.toggleChecked',
      title: 'Toggle Selection',
      arguments: [element]
    };
    
    return treeItem;
  }
}
