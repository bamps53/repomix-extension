import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('VS Code Extension Integration Tests', () => {
  
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('daisuke.repomix-extension'));
  });

  test('VS Code workspace API should be available', () => {
    assert.ok(vscode.workspace);
    assert.ok(vscode.workspace.fs);
    assert.ok(typeof vscode.workspace.fs.readDirectory === 'function');
  });

  test('VS Code window API should be available', () => {
    assert.ok(vscode.window);
    assert.ok(typeof vscode.window.showErrorMessage === 'function');
    assert.ok(typeof vscode.window.showInformationMessage === 'function');
  });

  test('VS Code commands API should be available', () => {
    assert.ok(vscode.commands);
    assert.ok(typeof vscode.commands.registerCommand === 'function');
  });

  test('VS Code URI should work correctly', () => {
    const testPath = '/test/path';
    const uri = vscode.Uri.file(testPath);
    assert.strictEqual(uri.fsPath, testPath);
    assert.ok(uri.toString().includes(testPath));
  });

  test('VS Code FileType constants should be available', () => {
    assert.ok(typeof vscode.FileType.File === 'number');
    assert.ok(typeof vscode.FileType.Directory === 'number');
    assert.ok(typeof vscode.FileType.Unknown === 'number');
  });

  test('VS Code TreeItem should be constructible', () => {
    const item = new vscode.TreeItem('test', vscode.TreeItemCollapsibleState.None);
    assert.strictEqual(item.label, 'test');
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test('VS Code ThemeIcon should be constructible', () => {
    const icon = new vscode.ThemeIcon('check');
    assert.strictEqual(icon.id, 'check');
  });
});