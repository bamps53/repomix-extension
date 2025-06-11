import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

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
  
  // アイコンパス
  private readonly checkedIconPath: vscode.Uri;
  private readonly uncheckedIconPath: vscode.Uri;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    
    // アイコンファイルのURIを作成
    const extensionPath = vscode.extensions.getExtension('repomix-extension')?.extensionUri.fsPath || __dirname;
    this.checkedIconPath = vscode.Uri.file(path.join(extensionPath, 'resources', 'checked.svg'));
    this.uncheckedIconPath = vscode.Uri.file(path.join(extensionPath, 'resources', 'unchecked.svg'));
  }
  
  /**
   * ワークスペースのルートパスを取得する
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * 変更イベントを発火させる
   */
  refresh(): void {
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
    const isCurrentlyChecked = element.contextValue === 'checked';

    // 状態の更新
    this.checkedItems.set(key, !isCurrentlyChecked);
    element.contextValue = isCurrentlyChecked ? 'unchecked' : 'checked';
    
    // アイテムがディレクトリの場合、すべての子アイテムも更新
    if (element.type === vscode.FileType.Directory) {
      await this.updateChildrenCheckState(element.resourceUri, !isCurrentlyChecked);
    }

    // UIを更新
    this._onDidChangeTreeData.fire(element);
  }

  /**
   * ディレクトリ内のすべての子アイテムのチェック状態を更新
   */
  private async updateChildrenCheckState(directoryUri: vscode.Uri, checked: boolean): Promise<void> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      for (const [name, type] of entries) {
        const childUri = vscode.Uri.joinPath(directoryUri, name);
        const key = childUri.toString();
        
        // 子アイテムの状態を更新
        this.checkedItems.set(key, checked);
        
        // 再帰的にサブディレクトリを処理
        if (type === vscode.FileType.Directory) {
          await this.updateChildrenCheckState(childUri, checked);
        }
      }
    } catch (error) {
      console.error(`Error updating children check state: ${error}`);
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
    this.refresh();
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
    
    if (fireEvent) {
      this.refresh();
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
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);
      
      return entries.map(([name, type]) => {
        const uri = vscode.Uri.joinPath(directoryUri, name);
        const key = uri.toString();
        const isChecked = this.checkedItems.get(key) || false;
        
        return {
          resourceUri: uri,
          type: type,
          contextValue: isChecked ? 'checked' : 'unchecked'
        };
      });
    } catch (error) {
      console.error(`Error reading directory ${directoryUri.fsPath}: ${error}`);
      return [];
    }
  }

  /**
   * TreeItemを生成する
   */
  getTreeItem(element: FileSystemItem): vscode.TreeItem {
    class FileTreeItem extends vscode.TreeItem {
      constructor(
        public readonly uri: vscode.Uri,
        public readonly checked: boolean,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private readonly checkedIconPath: vscode.Uri,
        private readonly uncheckedIconPath: vscode.Uri,
        public readonly command?: vscode.Command
      ) {
        super(uri, collapsibleState);

        // ツリーアイテムのラベルを設定
        this.label = path.basename(uri.fsPath);

        // チェック状態をツールチップに表示
        this.tooltip = `${this.label} ${checked ? '(選択済み)' : ''}`;

        // アイコンの設定
        this.iconPath = checked ? this.checkedIconPath : this.uncheckedIconPath;
        
        // コンテキストバリューにチェック状態を追加
        this.contextValue = checked ? 'checkedFileTreeItem' : 'uncheckedFileTreeItem';
      }

      // 基本コンテキスト値は fileTreeItem
      contextValue = 'fileTreeItem';
    }

    const isDirectory = element.type === vscode.FileType.Directory;
    const isChecked = element.contextValue === 'checked';
    
    // ファイル名を取得
    const fileName = path.basename(element.resourceUri.fsPath);
    
    // TreeItemを生成
    const treeItem = new FileTreeItem(
      element.resourceUri,
      isChecked,
      isDirectory 
        ? vscode.TreeItemCollapsibleState.Collapsed 
        : vscode.TreeItemCollapsibleState.None,
      this.checkedIconPath,
      this.uncheckedIconPath,
      {
        command: 'repomix-extension.toggleChecked',
        title: 'Toggle Checked',
        arguments: [element]
      }
    );
    
    return treeItem;
  }
}
