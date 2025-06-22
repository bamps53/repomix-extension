import * as vscode from 'vscode';

interface SearchItem {
  type: 'search';
}

/**
 * Search provider for the search view
 * Provides a dedicated search interface above the file tree
 */
export class SearchProvider implements vscode.TreeDataProvider<SearchItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SearchItem | undefined | null | void> = 
    new vscode.EventEmitter<SearchItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<SearchItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private searchQuery: string = '';
  private onSearchChangeCallback?: (query: string) => void;

  constructor() {}

  /**
   * Set callback for search query changes
   */
  setOnSearchChange(callback: (query: string) => void): void {
    this.onSearchChangeCallback = callback;
  }

  /**
   * Get current search query
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  /**
   * Set search query
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this._onDidChangeTreeData.fire();
    
    // Notify file tree provider
    if (this.onSearchChangeCallback) {
      this.onSearchChangeCallback(query);
    }
  }

  /**
   * Get tree items
   */
  getTreeItem(element: SearchItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.searchQuery || 'Click to search files...',
      vscode.TreeItemCollapsibleState.None
    );
    
    item.iconPath = new vscode.ThemeIcon(this.searchQuery ? 'filter' : 'search');
    item.contextValue = 'searchItem';
    item.tooltip = this.searchQuery 
      ? `Filtering: "${this.searchQuery}" - Click to edit`
      : 'Click to start searching files';
    
    // Add description to show current filter status
    if (this.searchQuery) {
      item.description = `Filtering active`;
    }
    
    // Command to open search input
    item.command = {
      command: 'repomix-extension.openSearchInput',
      title: 'Open Search',
      arguments: []
    };
    
    return item;
  }

  /**
   * Get children - search view only has one item
   */
  getChildren(element?: SearchItem): Thenable<SearchItem[]> {
    if (!element) {
      return Promise.resolve([{ type: 'search' }]);
    }
    return Promise.resolve([]);
  }
}