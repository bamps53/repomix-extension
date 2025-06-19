/**
 * Mock implementation of VS Code API for unit testing
 * This allows running tests without the full VS Code extension host
 */

export const Uri = {
    file: (path: string) => ({
        fsPath: path,
        toString: () => `file://${path}`,
        scheme: 'file',
        authority: '',
        path: path,
        query: '',
        fragment: ''
    })
};

export const FileType = {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
};

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

export class TreeItem {
    label?: string;
    id?: string;
    iconPath?: any;
    resourceUri?: any;
    tooltip?: string;
    command?: any;
    collapsibleState?: number;
    contextValue?: string;

    constructor(label?: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class ThemeIcon {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

export const window = {
    showErrorMessage: (message: string) => Promise.resolve(message),
    showInformationMessage: (message: string) => Promise.resolve(message),
    showWarningMessage: (message: string) => Promise.resolve(message),
    showInputBox: (options?: any) => Promise.resolve('test-input'),
    showQuickPick: (items: any[], options?: any) => Promise.resolve(items[0]),
    registerTreeDataProvider: () => ({ dispose: () => {} }),
    createTreeView: () => ({ dispose: () => {} }),
    showTextDocument: () => Promise.resolve()
};

export const workspace = {
    workspaceFolders: [
        {
            uri: Uri.file('/test/workspace'),
            name: 'test-workspace',
            index: 0
        }
    ],
    fs: {
        readDirectory: (uri: any) => {
            // 完全に安全なファイル構造 - 無限ループを完全に防ぐ
            const path = uri.fsPath || uri.path || '';
            
            // 厳密にパスをチェックして既知のパスのみ処理
            const knownPaths: Record<string, [string, number][]> = {
                '/test/workspace': [
                    ['file1.txt', FileType.File],
                    ['file2.txt', FileType.File], 
                    ['package.json', FileType.File]
                ]
                // ディレクトリは一切返さない（無限再帰完全防止）
            };
            
            // パスの正規化と厳密チェック
            const normalizedPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
            
            // 完全一致のみ許可、部分一致や類似パスは拒否
            if (knownPaths.hasOwnProperty(normalizedPath)) {
                return Promise.resolve(knownPaths[normalizedPath]);
            }
            
            // 未知のパスは常に空を返す
            return Promise.resolve([]);
        },
        stat: (uri: any) => Promise.resolve({
            type: FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 100
        })
    },
    openTextDocument: (options: any) => Promise.resolve({
        uri: Uri.file('/test/document'),
        fileName: '/test/document',
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false,
        save: () => Promise.resolve(true),
        eol: 1,
        lineCount: 1,
        getText: () => options.content || 'test content'
    })
};

export const commands = {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
        return { dispose: () => {} };
    },
    executeCommand: (command: string, ...args: any[]) => Promise.resolve()
};

export class EventEmitter {
    private listeners: { [event: string]: Function[] } = {};

    on(event: string, listener: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    fire(event: string, ...args: any[]) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(listener => listener(...args));
        }
    }

    get event() {
        return (listener: Function) => this.on('change', listener);
    }
}

// Default export for compatibility
export default {
    Uri,
    FileType,
    TreeItemCollapsibleState,
    TreeItem,
    ThemeIcon,
    window,
    workspace,
    commands,
    EventEmitter
};