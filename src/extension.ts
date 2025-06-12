// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileTreeProvider } from './fileTree';
import { ProfileManager } from './profileManager';
import { executeRepomix, showRepomixResult, RepomixOptions } from './repomixRunner';

import * as path from 'path';
import * as childProcess from 'child_process';
import * as util from 'util';

// プロファイルの型定義
interface Profile {
  name: string;
  checkedPaths: string[];
}

export function activate(context: vscode.ExtensionContext) {
  console.log('🔥 Repomix Extension activated!');
  
  // 作業ディレクトリを取得
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
  
  // FileTreeProviderのインスタンスを作成
  const fileTreeProvider = new FileTreeProvider(workspaceRoot, context);
  
  // ProfileManagerのインスタンスを作成
  const profileManager = new ProfileManager(context);
  
  // ファイルツリービューの登録
  vscode.window.registerTreeDataProvider('repomixFileExplorer', fileTreeProvider);
  
  // プロファイル管理ビューの登録
  vscode.window.registerTreeDataProvider('repomixProfiles', profileManager);

  // トグルコマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.toggleChecked', (item: any) => {
      fileTreeProvider.toggleChecked(item);
    })
  );

  // リフレッシュコマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.refresh', () => {
      fileTreeProvider.refresh();
      vscode.window.showInformationMessage('File tree refreshed and all selections cleared');
    })
  );

  // Select Allコマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.selectAll', async () => {
      await fileTreeProvider.selectAll();
      vscode.window.showInformationMessage('All files and folders selected');
    })
  );

  // プロファイル保存コマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.saveProfile', async () => {
      const profileName = await vscode.window.showInputBox({
        title: 'Enter profile name',
        placeHolder: 'e.g. project-a-config',
      });

      if (profileName) {
        // 選択されたファイルパスを取得
        const checkedItems = fileTreeProvider.getCheckedItems();
        
        // ProfileManagerを使用してプロファイルを保存
        const savedProfile = profileManager.saveProfile(profileName, checkedItems);
        
        vscode.window.showInformationMessage(`Profile "${profileName}" saved successfully.`);
      }
    })
  );


  // プロファイル読み込みコマンドの登録（従来のコマンド維持）
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.loadProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // TreeViewからの呼び出しかどうかを判定
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // 保存されているプロファイル一覧を取得
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // プロファイルを選択
        const selectedProfileItem = await vscode.window.showQuickPick(
          profiles.map(p => ({ 
            label: p.name,
            detail: `${p.paths.length} files - ${new Date(p.createdAt).toLocaleString()}`,
            profile: p
          })),
          {
            title: 'Select profile to load',
            placeHolder: 'Select a profile...',
          }
        );
        
        profileName = selectedProfileItem?.profile.name;
      }
      
      if (profileName) {
        // 選択されたプロファイルを読み込み
        const profile = profileManager.loadProfile(profileName);
        
        if (profile) {
          // ファイルツリーの選択状態をリセット
          fileTreeProvider.uncheckAll();
          
          // 保存されていたパスを選択状態に設定
          for (const path of profile.paths) {
            fileTreeProvider.setChecked(path, true, false);
          }
          
          // ツリービューを更新（選択状態をクリアしない）
          fileTreeProvider.updateView();
          
          vscode.window.showInformationMessage(`Profile "${profileName}" loaded successfully.`);
        }
      }
    })
  );

  // プロファイルリネームコマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.renameProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // TreeViewからの呼び出しかどうかを判定
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // 保存されているプロファイル一覧を取得
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // リネームするプロファイルを選択
        const selectedProfileItem = await vscode.window.showQuickPick(
          profiles.map(p => ({ 
            label: p.name,
            detail: `${p.paths.length} files - ${new Date(p.createdAt).toLocaleString()}`,
            profile: p
          })),
          {
            title: 'Select profile to rename',
            placeHolder: 'Select a profile...',
          }
        );
        
        profileName = selectedProfileItem?.profile.name;
      }
      
      if (profileName) {
        // 新しい名前を入力
        const newName = await vscode.window.showInputBox({
          title: 'Rename Profile',
          placeHolder: 'Enter new profile name',
          value: profileName,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Profile name cannot be empty';
            }
            if (value === profileName) {
              return null; // Same name is OK
            }
            const profiles = profileManager.getProfiles();
            if (profiles.some(p => p.name === value)) {
              return 'Profile name already exists';
            }
            return null;
          }
        });
        
        if (newName && newName !== profileName) {
          const renamed = profileManager.renameProfile(profileName, newName);
          
          if (renamed) {
            vscode.window.showInformationMessage(`Profile renamed from "${profileName}" to "${newName}".`);
          } else {
            vscode.window.showErrorMessage('Failed to rename profile.');
          }
        }
      }
    })
  );

  // プロファイル削除コマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.deleteProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // TreeViewからの呼び出しかどうかを判定
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // 保存されているプロファイル一覧を取得
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // 削除するプロファイルを選択
        const selectedProfileItem = await vscode.window.showQuickPick(
          profiles.map(p => ({ 
            label: p.name,
            detail: `${p.paths.length} files - ${new Date(p.createdAt).toLocaleString()}`,
            profile: p
          })),
          {
            title: 'Select profile to delete',
            placeHolder: 'Select a profile...',
          }
        );
        
        profileName = selectedProfileItem?.profile.name;
      }
      
      if (profileName) {
        // 確認ダイアログを表示
        const confirmed = await vscode.window.showWarningMessage(
          `Delete profile "${profileName}"?`, 
          { modal: true },
          'Delete'
        );
        
        if (confirmed === 'Delete') {
          // ProfileManagerを使用してプロファイルを削除
          const deleted = profileManager.deleteProfile(profileName);
          
          if (deleted) {
            vscode.window.showInformationMessage(`Profile "${profileName}" deleted successfully.`);
          }
        }
      }
    })
  );

  // repomix実行コマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.executeRepomix', async () => {
      const checkedPaths = fileTreeProvider.getCheckedItems();
      
      if (checkedPaths.length === 0) {
        vscode.window.showWarningMessage('No files selected. Please select files to execute.');
        return;
      }
      
      try {
        vscode.window.showInformationMessage('Executing Repomix...');

        // ワークスペースルートを取得
        const wsRoot = fileTreeProvider.getWorkspaceRoot();
        
        // 選択されたファイルのパス情報を取得
        const fileInfo = checkedPaths.map(filePath => {
          // 作業ディレクトリからの相対パスを計算
          const relativePath = path.relative(wsRoot, filePath);
          return {
            fullPath: filePath,
            relativePath: relativePath
          };
        });

        // repomix の実行オプションを構築
        const repomixOptions: RepomixOptions = {
          files: fileInfo.map(f => f.relativePath),
          workspaceRoot: wsRoot,
          additionalOptions: {
            // 必要に応じて追加オプションを設定可能
          }
        };
        
        // repomixを実行して結果を取得
        const result = await executeRepomix(repomixOptions);
        
        // 生成されたXMLファイルを開く
        await showRepomixResult(repomixOptions);
        
        // 実行結果に応じて通知を表示
        if (result.success) {
          vscode.window.showInformationMessage(`Repomix execution completed. Processed ${fileInfo.length} files.`);
        } else {
          vscode.window.showErrorMessage(`Repomix execution failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Error executing repomix:', error);
        vscode.window.showErrorMessage(`Failed to execute Repomix: ${error}`);
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
