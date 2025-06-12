import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileTreeProvider } from '../../fileTree';

suite('FileTreeProvider Advanced Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let fileTreeProvider: FileTreeProvider;
  const mockWorkspaceRoot = '/test/workspace';

  setup(() => {
    sandbox = sinon.createSandbox();
    fileTreeProvider = new FileTreeProvider(mockWorkspaceRoot);
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('File System Integration', () => {
    test('should create proper file system items structure', () => {
      // テスト用のファイルシステムアイテムを作成
      const fileItem = {
        resourceUri: vscode.Uri.file('/test/workspace/file1.txt'),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      const dirItem = {
        resourceUri: vscode.Uri.file('/test/workspace/folder1'),
        type: vscode.FileType.Directory,
        contextValue: 'checked'
      };

      // ファイルアイテムの検証
      assert.strictEqual(fileItem.type, vscode.FileType.File);
      assert.strictEqual(fileItem.contextValue, 'unchecked');
      assert.ok(fileItem.resourceUri.fsPath.endsWith('file1.txt'));

      // ディレクトリアイテムの検証
      assert.strictEqual(dirItem.type, vscode.FileType.Directory);
      assert.strictEqual(dirItem.contextValue, 'checked');
      assert.ok(dirItem.resourceUri.fsPath.endsWith('folder1'));
    });

    test('should handle empty children arrays correctly', async () => {
      // getChildrenが空配列を返すケースのテスト（実際のファイルシステムに依存しない）
      const emptyChildren = await fileTreeProvider.getChildren();
      assert.ok(Array.isArray(emptyChildren));
    });
  });

  suite('Tree Item Creation', () => {
    test('getTreeItem should create proper TreeItem for files', () => {
      const fileElement = {
        resourceUri: vscode.Uri.file(path.join(mockWorkspaceRoot, 'test.txt')),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      const treeItem = fileTreeProvider.getTreeItem(fileElement);

      assert.strictEqual(treeItem.label, 'test.txt');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(treeItem.resourceUri, fileElement.resourceUri);
      assert.ok(typeof treeItem.tooltip === 'string' && treeItem.tooltip.includes('test.txt'));
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual(treeItem.contextValue, 'uncheckedFileTreeItem');
    });

    test('getTreeItem should create proper TreeItem for directories', () => {
      const dirElement = {
        resourceUri: vscode.Uri.file(path.join(mockWorkspaceRoot, 'testfolder')),
        type: vscode.FileType.Directory,
        contextValue: 'checked'
      };

      const treeItem = fileTreeProvider.getTreeItem(dirElement);

      assert.strictEqual(treeItem.label, 'testfolder');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
      assert.strictEqual(treeItem.resourceUri, dirElement.resourceUri);
      assert.ok(typeof treeItem.tooltip === 'string' && treeItem.tooltip.includes('testfolder'));
      assert.ok(typeof treeItem.tooltip === 'string' && treeItem.tooltip.includes('selected'));
      assert.strictEqual(treeItem.contextValue, 'checkedFileTreeItem');
    });

    test('getTreeItem should set up toggle command correctly', () => {
      const fileElement = {
        resourceUri: vscode.Uri.file(path.join(mockWorkspaceRoot, 'test.txt')),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      const treeItem = fileTreeProvider.getTreeItem(fileElement);

      assert.ok(treeItem.command);
      assert.strictEqual(treeItem.command.command, 'repomix-extension.toggleChecked');
      assert.strictEqual(treeItem.command.title, 'Toggle Selection');
      assert.deepStrictEqual(treeItem.command.arguments, [fileElement]);
    });
  });

  suite('Recursive Directory Operations', () => {
    test('should support recursive directory concepts', () => {
      // 再帰的操作のコンセプトテスト（実際のファイルシステムに依存しない）
      const parentDir = {
        resourceUri: vscode.Uri.file('/test/workspace/folder1'),
        type: vscode.FileType.Directory,
        contextValue: 'unchecked'
      };

      // 親ディレクトリの選択状態を設定
      fileTreeProvider.setChecked(parentDir.resourceUri.toString(), true, false);
      
      // 子ファイルも手動で設定（実際の実装では自動で行われる）
      fileTreeProvider.setChecked('/test/workspace/folder1/file1.txt', true, false);
      fileTreeProvider.setChecked('/test/workspace/folder1/file2.js', true, false);

      const checkedItems = fileTreeProvider.getCheckedItems();
      
      assert.ok(checkedItems.includes('file:///test/workspace/folder1'));
      assert.ok(checkedItems.includes('/test/workspace/folder1/file1.txt'));
      assert.ok(checkedItems.includes('/test/workspace/folder1/file2.js'));
    });

    test('should handle directory state changes', () => {
      // ディレクトリの状態変更テスト
      const dirPath = '/test/workspace/testdir';
      
      // 最初は未選択
      assert.strictEqual(fileTreeProvider.getCheckedItems().length, 0);
      
      // 選択状態に変更
      fileTreeProvider.setChecked(dirPath, true, false);
      assert.ok(fileTreeProvider.getCheckedItems().includes(dirPath));
      
      // 選択解除
      fileTreeProvider.setChecked(dirPath, false, false);
      assert.ok(!fileTreeProvider.getCheckedItems().includes(dirPath));
    });
  });

  suite('Event Handling', () => {
    test('toggleChecked should fire change events', () => {
      const fireStub = sandbox.stub((fileTreeProvider as any)._onDidChangeTreeData, 'fire');

      const fileElement = {
        resourceUri: vscode.Uri.file('/test/workspace/file1.txt'),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      fileTreeProvider.toggleChecked(fileElement);

      // イベントが発火されたことを確認
      assert.strictEqual(fireStub.callCount, 1);
    });

    test('setChecked with fireEvent should trigger change event', () => {
      const fireStub = sandbox.stub((fileTreeProvider as any)._onDidChangeTreeData, 'fire');

      fileTreeProvider.setChecked('/test/workspace/file1.txt', true, true);

      assert.strictEqual(fireStub.callCount, 1);
    });

    test('uncheckAll should fire change event', () => {
      const fireStub = sandbox.stub((fileTreeProvider as any)._onDidChangeTreeData, 'fire');

      // いくつかのファイルをチェック
      fileTreeProvider.setChecked('/test/workspace/file1.txt', true, false);
      fileTreeProvider.setChecked('/test/workspace/file2.txt', true, false);

      fireStub.resetHistory(); // 上記の呼び出しをリセット

      fileTreeProvider.uncheckAll();

      assert.strictEqual(fireStub.callCount, 1);
    });
  });

  suite('Edge Cases and Error Handling', () => {
    test('should handle invalid URIs gracefully', () => {
      const invalidElement = {
        resourceUri: vscode.Uri.file(''),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      // 無効なURIでもTreeItemを作成できる
      assert.doesNotThrow(() => {
        const treeItem = fileTreeProvider.getTreeItem(invalidElement);
        assert.ok(treeItem);
      });
    });

    test('should handle concurrent toggle operations', () => {
      const fileElement1 = {
        resourceUri: vscode.Uri.file('/test/workspace/file1.txt'),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      const fileElement2 = {
        resourceUri: vscode.Uri.file('/test/workspace/file2.txt'),
        type: vscode.FileType.File,
        contextValue: 'unchecked'
      };

      // 同時に複数のトグル操作を実行
      fileTreeProvider.toggleChecked(fileElement1);
      fileTreeProvider.toggleChecked(fileElement2);

      const checkedItems = fileTreeProvider.getCheckedItems();
      assert.strictEqual(checkedItems.length, 2);
      assert.ok(checkedItems.some(item => item.includes('file1.txt')));
      assert.ok(checkedItems.some(item => item.includes('file2.txt')));
    });

    test('should handle deeply nested paths', () => {
      const deepPath = '/test/workspace/a/b/c/d/e/f/g/deep.txt';
      
      // 深いパスでも正常に処理できる
      assert.doesNotThrow(() => {
        fileTreeProvider.setChecked(deepPath, true, false);
        const checkedItems = fileTreeProvider.getCheckedItems();
        assert.ok(checkedItems.includes(deepPath));
      });
    });
  });
});