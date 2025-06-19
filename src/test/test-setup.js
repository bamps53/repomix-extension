const sinon = require('sinon');

// Mock vscode module for unit tests
const vscode = {
  Uri: {
    file: (path) => ({
      fsPath: path,
      toString: () => `file://${path}`,
      scheme: 'file',
      path: path
    }),
    parse: (str) => ({
      fsPath: str.replace('file://', ''),
      toString: () => str,
      scheme: 'file'
    }),
    joinPath: (base, ...pathSegments) => {
      const path = require('path');
      const joined = path.join(base.fsPath, ...pathSegments);
      return {
        fsPath: joined,
        toString: () => `file://${joined}`,
        scheme: 'file',
        path: joined
      };
    }
  },
  TreeItem: class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
  },
  EventEmitter: class EventEmitter {
    constructor() {
      this._listeners = [];
    }
    get event() {
      return (listener) => {
        this._listeners.push(listener);
        return { dispose: () => {} };
      };
    }
    fire(data) {
      this._listeners.forEach(listener => listener(data));
    }
  },
  window: {
    showErrorMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
    showInputBox: sinon.stub(),
    showQuickPick: sinon.stub(),
    createTreeView: sinon.stub()
  },
  workspace: {
    fs: {
      stat: () => Promise.resolve({}),
      readDirectory: () => Promise.resolve([])
    },
    getConfiguration: sinon.stub().returns({
      get: sinon.stub(),
      update: sinon.stub()
    }),
    workspaceFolders: []
  },
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub()
  },
  ThemeIcon: class ThemeIcon {
    constructor(id) {
      this.id = id;
    }
  },
  ExtensionContext: class ExtensionContext {},
  Disposable: class Disposable {
    static from(...items) {
      return { dispose: () => {} };
    }
  }
};

// Mock the vscode module - create a fake module entry
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain) {
  if (request === 'vscode') {
    // Return a fake path for vscode module
    return 'vscode';
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Cache the mock
require.cache['vscode'] = {
  exports: vscode
};

// Override require to return our mock for vscode
const originalRequire = require;
require = function(id) {
  if (id === 'vscode') {
    return vscode;
  }
  return originalRequire.apply(this, arguments);
};