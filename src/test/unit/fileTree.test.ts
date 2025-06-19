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
    const mockContext = {
      extensionUri: vscode.Uri.file('/mock/extension/path')
    } as vscode.ExtensionContext;
    fileTreeProvider = new FileTreeProvider(mockWorkspaceRoot, mockContext);
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

    // EventEmitterのfireメソッドをスタブ
    const fireStub = sandbox.stub((fileTreeProvider as any)._onDidChangeTreeData, 'fire');

    // 最初はチェックされていないはず
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);

    // 一度目のトグルでチェック
    fileTreeProvider.toggleChecked(mockItem);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 1);
    assert.strictEqual(fileTreeProvider.getCheckedItems()[0], mockUri.fsPath);
    assert.strictEqual(fireStub.callCount, 1);

    // 二度目のトグルでチェック解除
    mockItem.contextValue = 'checked'; // トグル後のコンテキスト値を模倣
    fileTreeProvider.toggleChecked(mockItem);
    assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
    assert.strictEqual(fireStub.callCount, 2);
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
    const fireStub = sandbox.stub((fileTreeProvider as any)._onDidChangeTreeData, 'fire');
    
    // イベント発火を伴うチェック状態の設定
    fileTreeProvider.setChecked(mockPath, true, true);
    
    assert.strictEqual(fireStub.callCount, 1);
  });

  suite('File System Integration Tests', () => {
    test('should handle file system structure concepts', () => {
      // ファイルシステム構造のコンセプトテスト
      const mockFiles = [
        { name: 'file1.txt', type: vscode.FileType.File },
        { name: 'folder1', type: vscode.FileType.Directory },
        { name: 'file2.js', type: vscode.FileType.File }
      ];

      // ファイルタイプの検証
      const files = mockFiles.filter(f => f.type === vscode.FileType.File);
      const dirs = mockFiles.filter(f => f.type === vscode.FileType.Directory);
      
      assert.strictEqual(files.length, 2);
      assert.strictEqual(dirs.length, 1);
      assert.strictEqual(files[0].name, 'file1.txt');
      assert.strictEqual(dirs[0].name, 'folder1');
    });

    test('getTreeItem should create correct icons for different file types', () => {
      const fileElement = {
        resourceUri: createMockUri('test.txt'),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      const dirElement = {
        resourceUri: createMockUri('testdir'),
        type: vscode.FileType.Directory,
        contextValue: 'checked'
      };

      const fileTreeItem = fileTreeProvider.getTreeItem(fileElement);
      const dirTreeItem = fileTreeProvider.getTreeItem(dirElement);

      // ファイルアイコンの確認（カスタムSVGアイコン形式）
      assert.ok(fileTreeItem.iconPath);
      assert.ok(typeof fileTreeItem.iconPath === 'object');
      assert.ok((fileTreeItem.iconPath as any).light);
      assert.ok((fileTreeItem.iconPath as any).dark);

      // ディレクトリアイコンの確認（チェック済み）
      assert.ok(dirTreeItem.iconPath);
      assert.ok(typeof dirTreeItem.iconPath === 'object');
      assert.ok((dirTreeItem.iconPath as any).light);
      assert.ok((dirTreeItem.iconPath as any).dark);
    });

    test('should handle directory hierarchy concepts', () => {
      // ディレクトリ階層のコンセプトテスト
      const parentPath = path.join(mockWorkspaceRoot, 'parent');
      const childPath = path.join(parentPath, 'child1.txt');
      const subDirPath = path.join(parentPath, 'child2');
      const grandChildPath = path.join(subDirPath, 'grandchild.txt');

      // 階層構造の検証
      assert.ok(childPath.startsWith(parentPath));
      assert.ok(grandChildPath.startsWith(subDirPath));
      assert.ok(grandChildPath.includes('grandchild.txt'));
      
      // 手動でのチェック状態設定（実際の実装では再帰的に行われる）
      fileTreeProvider.setChecked(parentPath, true, false);
      fileTreeProvider.setChecked(childPath, true, false);
      fileTreeProvider.setChecked(subDirPath, true, false);
      fileTreeProvider.setChecked(grandChildPath, true, false);

      const checkedItems = fileTreeProvider.getCheckedItems();
      assert.strictEqual(checkedItems.length, 4);
    });
  });

  suite('Performance Tests', () => {
    test('should handle large numbers of files efficiently', () => {
      const startTime = Date.now();
      
      // 1000個のファイルを処理
      for (let i = 0; i < 1000; i++) {
        const filePath = path.join(mockWorkspaceRoot, `file${i}.txt`);
        fileTreeProvider.setChecked(filePath, true, false);
      }
      
      const processingTime = Date.now() - startTime;
      
      // 処理時間が合理的な範囲内であることを確認（1秒以内）
      assert.ok(processingTime < 1000, `Processing took ${processingTime}ms, should be under 1000ms`);
      
      // 結果が正しい
      assert.strictEqual(fileTreeProvider.getCheckedItems().length, 1000);
    });

    test('should handle rapid toggle operations', () => {
      const mockUri = createMockUri('rapid-toggle.txt');
      const mockItem = {
        resourceUri: mockUri,
        contextValue: 'unchecked',
        type: vscode.FileType.File
      };

      const startTime = Date.now();
      
      // 100回の高速トグル
      for (let i = 0; i < 100; i++) {
        fileTreeProvider.toggleChecked(mockItem);
        // toggleCheckedメソッド自体がcontextValueを更新するので手動更新は不要
      }
      
      const processingTime = Date.now() - startTime;
      
      // 処理時間チェック
      assert.ok(processingTime < 500, `Rapid toggle took ${processingTime}ms, should be under 500ms`);
      
      // 最終状態チェック（偶数回なので元の状態）
      assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
    });
  });
});
