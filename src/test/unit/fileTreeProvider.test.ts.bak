import * as sinon from 'sinon';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { FileTreeProvider } from '../../fileTree';

describe('FileTreeProvider', () => {
  let fileTreeProvider: FileTreeProvider;
  let workspaceStub: sinon.SinonStub;

  beforeEach(() => {
    // Mock vscode.workspace functions
    workspaceStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: vscode.Uri.file('/test/workspace'),
        name: 'test',
        index: 0
      }
    ]);

    fileTreeProvider = new FileTreeProvider();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getChildren', () => {
    it('should return root folders when no element is provided', async () => {
      const mockReadDirectory = sinon.stub(vscode.workspace.fs, 'readDirectory').resolves([
        ['folder1', vscode.FileType.Directory],
        ['file1.txt', vscode.FileType.File]
      ]);

      const children = await fileTreeProvider.getChildren();
      
      expect(children).to.not.be.undefined;
      expect(children?.length).to.be.at.least(1);
      expect(mockReadDirectory.called).to.be.true;
    });

    it('should return child items when element is provided', async () => {
      const mockElement = {
        resourceUri: vscode.Uri.file('/test/workspace/folder1'),
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: 'unchecked'
      };

      const mockReadDirectory = sinon.stub(vscode.workspace.fs, 'readDirectory').resolves([
        ['subfolder', vscode.FileType.Directory],
        ['file.txt', vscode.FileType.File]
      ]);

      const children = await fileTreeProvider.getChildren(mockElement);
      
      expect(children).to.not.be.undefined;
      expect(mockReadDirectory.called).to.be.true;
    });
  });

  describe('getTreeItem', () => {
    it('should return a TreeItem with the correct properties for a file', () => {
      const element = {
        resourceUri: vscode.Uri.file('/test/workspace/file.txt'),
        type: vscode.FileType.File
      };

      const treeItem = fileTreeProvider.getTreeItem(element);
      
      expect(treeItem.label).to.equal('file.txt');
      expect(treeItem.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
      expect(treeItem.contextValue).to.equal('unchecked');
    });

    it('should return a TreeItem with the correct properties for a directory', () => {
      const element = {
        resourceUri: vscode.Uri.file('/test/workspace/folder'),
        type: vscode.FileType.Directory
      };

      const treeItem = fileTreeProvider.getTreeItem(element);
      
      expect(treeItem.label).to.equal('folder');
      expect(treeItem.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.Collapsed);
      expect(treeItem.contextValue).to.equal('unchecked');
    });
  });

  describe('toggleChecked', () => {
    it('should toggle item from unchecked to checked', async () => {
      const element = {
        resourceUri: vscode.Uri.file('/test/workspace/file.txt'),
        contextValue: 'unchecked'
      };

      // Set up a spy on the fireTreeDataChanged event
      const eventSpy = sinon.spy();
      fileTreeProvider.onDidChangeTreeData(eventSpy);

      await fileTreeProvider.toggleChecked(element);
      
      expect(element.contextValue).to.equal('checked');
      expect(eventSpy.called).to.be.true;
    });

    it('should toggle item from checked to unchecked', async () => {
      const element = {
        resourceUri: vscode.Uri.file('/test/workspace/file.txt'),
        contextValue: 'checked'
      };

      // Set up a spy on the fireTreeDataChanged event
      const eventSpy = sinon.spy();
      fileTreeProvider.onDidChangeTreeData(eventSpy);

      await fileTreeProvider.toggleChecked(element);
      
      expect(element.contextValue).to.equal('unchecked');
      expect(eventSpy.called).to.be.true;
    });
  });
});
