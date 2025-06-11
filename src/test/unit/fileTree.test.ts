import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from '../../fileTree';

suite('FileTreeProvider Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let fileTreeProvider: FileTreeProvider;
  const mockWorkspaceRoot = '/test/workspace';
  
  // モック用のURIを作成
  const createMockUri = (filePath: string) => {
    return { 
      fsPath: path.join(mockWorkspaceRoot, filePath),
      toString: () => `file://${path.join(mockWorkspaceRoot, filePath)}`
    } as vscode.Uri;
  };

  setup(() => {
    sandbox = sinon.createSandbox();
    fileTreeProvider = new FileTreeProvider(mockWorkspaceRoot);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('getWorkspaceRoot should return the correct workspace root', () => {
    assert.strictEqual(fileTreeProvider.getWorkspaceRoot(), mockWorkspaceRoot);
  });

  test('toggleChecked should toggle item checked state', () => {
    const mockUri = createMockUri('file1.txt');
    const mockItem = {
      resourceUri: mockUri,
      contextValue: 'unchecked',
      type: vscode.FileType.File
    };

    // ファイアイベント関数のスタブ
    const fireChangeEventStub = sandbox.stub(fileTreeProvider as any, '_fireChangeEvent');

    // 最初はチェックされていないはず
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);

    // 一度目のトグルでチェック
    fileTreeProvider.toggleChecked(mockItem);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 1);
    assert.strictEqual(fileTreeProvider.getCheckedItems()[0], mockUri.fsPath);
    assert.strictEqual(fireChangeEventStub.callCount, 1);

    // 二度目のトグルでチェック解除
    mockItem.contextValue = 'checked'; // トグル後のコンテキスト値を模倣
    fileTreeProvider.toggleChecked(mockItem);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
    assert.strictEqual(fireChangeEventStub.callCount, 2);
  });

  test('setChecked should set checked state directly', () => {
    const mockPath = path.join(mockWorkspaceRoot, 'file1.txt');
    
    // まだチェックされていない
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
    
    // チェック状態を設定
    fileTreeProvider.setChecked(mockPath, true);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 1);
    assert.strictEqual(fileTreeProvider.getCheckedItems()[0], mockPath);
    
    // チェック状態を解除
    fileTreeProvider.setChecked(mockPath, false);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
  });

  test('uncheckAll should clear all checked items', () => {
    const paths = [
      path.join(mockWorkspaceRoot, 'file1.txt'),
      path.join(mockWorkspaceRoot, 'file2.txt'),
      path.join(mockWorkspaceRoot, 'dir/file3.txt')
    ];
    
    // 複数のアイテムをチェック
    paths.forEach(p => fileTreeProvider.setChecked(p, true, false));
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 3);
    
    // すべてのチェックを解除
    fileTreeProvider.uncheckAll();
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
  });

  test('getCheckedItems should return array of checked paths', () => {
    const paths = [
      path.join(mockWorkspaceRoot, 'file1.txt'),
      path.join(mockWorkspaceRoot, 'dir/file2.txt')
    ];
    
    // パスをチェック
    paths.forEach(p => fileTreeProvider.setChecked(p, true, false));
    
    // チェック済みアイテムを取得
    const checkedItems = fileTreeProvider.getCheckedItems();
    assert.strictEqual(checkedItems.length, 2);
    assert.ok(checkedItems.includes(paths[0]));
    assert.ok(checkedItems.includes(paths[1]));
  });

  // エッジケーステスト
  test('setChecked should handle non-existent paths', () => {
    const nonExistentPath = path.join(mockWorkspaceRoot, 'non-existent.txt');
    
    // 存在しないパスをチェック
    fileTreeProvider.setChecked(nonExistentPath, true);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 1);
    assert.strictEqual(fileTreeProvider.getCheckedItems()[0], nonExistentPath);
  });

  test('setChecked with fireEvent should trigger change event', () => {
    const mockPath = path.join(mockWorkspaceRoot, 'file1.txt');
    const fireChangeEventStub = sandbox.stub(fileTreeProvider as any, '_fireChangeEvent');
    
    // イベント発火を伴うチェック状態の設定
    fileTreeProvider.setChecked(mockPath, true, true);
    
    assert.strictEqual(fireChangeEventStub.callCount, 1);
  });
});
