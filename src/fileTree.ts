import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { RepomixConfigUtil } from './repomixConfig';
import { FileTreeCache } from './cache/FileTreeCache';

/**
 * Type representing a file system entry
 */
export interface FileSystemItem {
  resourceUri: vscode.Uri;
  type?: vscode.FileType;
  contextValue?: string;
}

/**
 * File tree provider
 * Displays file structure in workspace and manages selection state
 */
export class FileTreeProvider implements vscode.TreeDataProvider<FileSystemItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FileSystemItem | undefined | null | void> = 
    new vscode.EventEmitter<FileSystemItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<FileSystemItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  // Internal map to hold selected items
  private checkedItems = new Map<string, boolean>();

  private workspaceRoot: string;
  private context: vscode.ExtensionContext;
  private repomixConfig: RepomixConfigUtil;
  private isTestEnvironment: boolean;
  private cache: FileTreeCache;
  private updateDebounceTimer?: NodeJS.Timeout;
  private pendingUpdates = new Set<string>();
  
  // Search filter related
  private searchQuery: string = '';
  private searchRegex: RegExp | null = null;
  private filteredFileCache = new Map<string, FileSystemItem[]>();
  
  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
    
    // Test environment detection
    this.isTestEnvironment = workspaceRoot.includes('/test/') || 
                           process.env.NODE_ENV === 'test' ||
                           typeof global !== 'undefined' && global.process?.env?.NODE_ENV === 'test';
    
    this.repomixConfig = new RepomixConfigUtil(workspaceRoot);
    this.cache = new FileTreeCache();
    
    // Load repomix config on initialization (disabled in test environment)
    if (!this.isTestEnvironment) {
      this.initializeRepomixConfig();
    }
    
    // Periodically clean expired cache
    setInterval(() => this.cache.cleanExpired(), 300000); // Every 5 minutes
  }

  /**
   * Initialize Repomix configuration
   */
  private async initializeRepomixConfig(): Promise<void> {
    try {
      await this.repomixConfig.loadConfig();
    } catch (error) {
      console.error('Error initializing repomix config:', error);
    }
  }
  
  /**
   * Get workspace root path
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Refresh file tree and reset all selection states
   */
  async refresh(): Promise<void> {
    // Clear all selection states
    this.checkedItems.clear();
    
    // Clear cache
    this.cache.clear();
    this.filteredFileCache.clear();
    
    // Reload repomix configuration
    await this.initializeRepomixConfig();
    
    // Update tree view
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update tree view without clearing selection state
   */
  updateView(element?: FileSystemItem): void {
    if (element) {
      // Update specific element only
      this.scheduleUpdate(element);
    } else {
      // Update all
      this._onDidChangeTreeData.fire();
    }
  }
  
  /**
   * Schedule update with debouncing
   */
  private scheduleUpdate(element: FileSystemItem): void {
    if (!element.resourceUri) {return;}
    
    const key = element.resourceUri.toString();
    this.pendingUpdates.add(key);
    
    // Clear existing timer
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    
    // Batch update after 50ms
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
   * Set search query and filter file tree
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query.trim();
    
    if (this.searchQuery) {
      // Convert VS Code search pattern to regex
      try {
        this.searchRegex = this.convertSearchQueryToRegex(this.searchQuery);
      } catch (error) {
        console.error('Invalid search pattern:', error);
        this.searchRegex = null;
      }
    } else {
      this.searchRegex = null;
    }
    
    // Clear filter cache
    this.filteredFileCache.clear();
    
    // Update tree view
    this._onDidChangeTreeData.fire();
  }
  
  /**
   * Get current search query
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }
  
  
  /**
   * Convert VS Code style search query to regex
   */
  private convertSearchQueryToRegex(query: string): RegExp {
    // Escape special characters except * and /
    let pattern = query.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // Convert wildcards (* -> .*)
    pattern = pattern.replace(/\*/g, '.*');
    
    // Case insensitive
    return new RegExp(pattern, 'i');
  }
  
  /**
   * Check if file path matches search query
   */
  private matchesSearchQuery(filePath: string): boolean {
    if (!this.searchRegex) {
      return true;
    }
    
    // Get relative path from workspace root for full path matching
    const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    
    // Check if query contains path separator
    if (this.searchQuery.includes('/')) {
      // Match against relative path for directory searches like "app/"
      return this.searchRegex.test(relativePath);
    } else {
      // Match against filename only for simple searches
      return this.searchRegex.test(fileName);
    }
  }
  
  /**
   * すべてのファイルとフォルダを選択する（フィルタ適用）
   */
  async selectAll(): Promise<void> {
    try {
      if (this.searchQuery) {
        // フィルタが適用されている場合は、表示されているアイテムのみ選択
        await this.selectFilteredItems(vscode.Uri.file(this.workspaceRoot));
      } else {
        // フィルタが適用されていない場合は、すべてのアイテムを選択
        await this.selectAllRecursive(vscode.Uri.file(this.workspaceRoot));
      }
      this.updateView();
    } catch (error) {
      console.error('Error selecting all items:', error);
    }
  }
  
  /**
   * フィルタリングされたアイテムのみを選択する
   */
  private async selectFilteredItems(directoryUri: vscode.Uri, visitedPaths: Set<string> = new Set()): Promise<void> {
    try {
      const dirPath = directoryUri.fsPath;
      
      // 循環参照防止
      if (visitedPaths.has(dirPath)) {
        return;
      }
      visitedPaths.add(dirPath);
      
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      for (const [name, type] of entries) {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // repomixの除外パターンをチェック
        const shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
        if (shouldIgnore) {
          continue;
        }
        
        if (type === vscode.FileType.File) {
          // Select only if file matches search
          if (this.matchesSearchQuery(filePath)) {
            const isValidSize = await this.repomixConfig.isFileSizeValid(filePath);
            if (isValidSize) {
              const key = childUri.toString();
              this.checkedItems.set(key, true);
            }
          }
        } else if (type === vscode.FileType.Directory) {
          // If directory path matches or contains matching files
          const hasMatchingFiles = await this.directoryHasMatchingFiles(childUri);
          if (hasMatchingFiles) {
            const key = childUri.toString();
            this.checkedItems.set(key, true);
            // 再帰的に処理
            await this.selectFilteredItems(childUri, visitedPaths);
          }
        }
      }
    } catch (error) {
      console.error(`Error selecting filtered items in directory ${directoryUri.fsPath}: ${error}`);
    }
  }
  
  /**
   * Check if directory contains files matching the search query
   */
  private async directoryHasMatchingFiles(directoryUri: vscode.Uri): Promise<boolean> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      for (const [name, type] of entries) {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const filePath = childUri.fsPath;
        
        // repomixの除外パターンをチェック
        const shouldIgnore = await this.repomixConfig.shouldIgnoreFile(filePath);
        if (shouldIgnore) {
          continue;
        }
        
        if (type === vscode.FileType.File) {
          if (this.matchesSearchQuery(filePath)) {
            return true;
          }
        } else if (type === vscode.FileType.Directory) {
          // 再帰的にチェック
          const hasMatching = await this.directoryHasMatchingFiles(childUri);
          if (hasMatching) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking directory for matching files: ${error}`);
      return false;
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
        // Root level
        if (!this.workspaceRoot) {
          return [];
        }
        
        return this.getFilesInDirectory(vscode.Uri.file(this.workspaceRoot));
      } else {
        // Child elements - return directory contents
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
    // フィルタが適用されている場合、キャッシュをチェック
    if (this.searchQuery) {
      const cacheKey = directoryUri.toString();
      const cached = this.filteredFileCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
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
      
      // 検索フィルタを適用
      let finalEntries = filteredEntries;
      if (this.searchQuery) {
        finalEntries = [];
        
        for (const item of filteredEntries) {
          const filePath = item.resourceUri.fsPath;
          
          if (item.type === vscode.FileType.File) {
            // ファイルの場合、検索にマッチするかチェック
            if (this.matchesSearchQuery(filePath)) {
              finalEntries.push(item);
            }
          } else if (item.type === vscode.FileType.Directory) {
            // For directories, check if:
            // 1. Directory path itself matches the search pattern, OR
            // 2. Directory contains matching files
            if (this.matchesSearchQuery(filePath)) {
              finalEntries.push(item);
            } else {
              const hasMatchingFiles = await this.directoryHasMatchingFiles(item.resourceUri);
              if (hasMatchingFiles) {
                finalEntries.push(item);
              }
            }
          }
        }
      }
      
      // VS Codeのデフォルトの並び順に従って、フォルダを先に、次にファイルを表示
      finalEntries.sort((a, b) => {
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
      
      // フィルタ適用時はキャッシュに保存
      if (this.searchQuery) {
        const cacheKey = directoryUri.toString();
        this.filteredFileCache.set(cacheKey, finalEntries);
      }
      
      return finalEntries;
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
   * Generate TreeItem
   */
  async getTreeItem(element: FileSystemItem): Promise<vscode.TreeItem> {
    const isDirectory = element.type === vscode.FileType.Directory;
    const isChecked = element.contextValue === 'checked';
    
    // ファイル名を取得
    const fileName = path.basename(element.resourceUri.fsPath);
    
    // Use fileName as display name
    const displayName = fileName;
    
    // TreeItemを生成
    const treeItem = new vscode.TreeItem(
      displayName,
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
