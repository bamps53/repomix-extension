/**
 * Test setup for running VS Code extension tests without the extension host
 * This file sets up module aliases to mock the VS Code API
 */

const Module = require('module');
const path = require('path');

// Mock the 'vscode' module
const vscode = {
    Uri: {
        file: (path) => ({
            fsPath: path,
            toString: () => `file://${path}`,
            scheme: 'file',
            authority: '',
            path: path,
            query: '',
            fragment: ''
        }),
        joinPath: (uri, ...pathSegments) => {
            const path = require('path');
            const newPath = path.join(uri.fsPath, ...pathSegments);
            return {
                fsPath: newPath,
                toString: () => `file://${newPath}`,
                scheme: 'file',
                authority: '',
                path: newPath,
                query: '',
                fragment: ''
            };
        },
        parse: (value) => {
            if (typeof value === 'string' && value.startsWith('file://')) {
                const path = value.substring(7);
                return {
                    fsPath: path,
                    toString: () => value,
                    scheme: 'file',
                    authority: '',
                    path: path,
                    query: '',
                    fragment: ''
                };
            }
            return {
                fsPath: value,
                toString: () => `file://${value}`,
                scheme: 'file',
                authority: '',
                path: value,
                query: '',
                fragment: ''
            };
        }
    },
    
    FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64
    },
    
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },
    
    TreeItem: class TreeItem {
        constructor(label, collapsibleState) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },
    
    ThemeIcon: class ThemeIcon {
        constructor(id) {
            this.id = id;
        }
    },
    
    window: {
        showErrorMessage: (message) => Promise.resolve(message),
        showInformationMessage: (message) => Promise.resolve(message),
        showWarningMessage: (message) => Promise.resolve(message),
        showInputBox: (options) => Promise.resolve('test-input'),
        showQuickPick: (items, options) => Promise.resolve(items[0]),
        registerTreeDataProvider: () => ({ dispose: () => {} }),
        createTreeView: () => ({ dispose: () => {} }),
        showTextDocument: () => Promise.resolve()
    },
    
    workspace: {
        workspaceFolders: [
            {
                uri: { fsPath: '/test/workspace' },
                name: 'test-workspace',
                index: 0
            }
        ],
        fs: {
            readDirectory: (uri) => Promise.resolve([
                ['test.txt', 1], // FileType.File
                ['folder', 2]    // FileType.Directory
            ]),
            stat: (uri) => Promise.resolve({
                type: 1, // FileType.File
                ctime: Date.now(),
                mtime: Date.now(),
                size: 100
            })
        },
        openTextDocument: (options) => Promise.resolve({
            uri: { fsPath: '/test/document' },
            fileName: '/test/document',
            languageId: 'markdown',
            version: 1,
            isDirty: false,
            isClosed: false,
            save: () => Promise.resolve(true),
            eol: 1,
            lineCount: 1,
            getText: () => options?.content || 'test content'
        })
    },
    
    commands: {
        registerCommand: (command, callback) => {
            return { dispose: () => {} };
        },
        executeCommand: (command, ...args) => Promise.resolve()
    },
    
    EventEmitter: class EventEmitter {
        constructor() {
            this.listeners = {};
            this._event = (listener) => {
                this.on('change', listener);
                return { dispose: () => {} };
            };
        }
        
        on(event, listener) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(listener);
        }
        
        fire(...args) {
            if (this.listeners['change']) {
                this.listeners['change'].forEach(listener => listener(...args));
            }
        }
        
        get event() {
            return this._event;
        }
        
        get onDidChangeTreeData() {
            return this._event;
        }
    },
    
    Disposable: class Disposable {
        constructor(callOnDispose) {
            this.callOnDispose = callOnDispose;
        }
        dispose() {
            if (this.callOnDispose) {
                this.callOnDispose();
            }
        }
    }
};

// Override Module._resolveFilename to intercept 'vscode' module requests
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
        // Return a fake filename for the vscode module
        return path.join(__dirname, 'vscode-mock.js');
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Override Module._load to provide the mock when 'vscode' is loaded
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return vscode;
    }
    return originalLoad.call(this, request, parent, isMain);
};