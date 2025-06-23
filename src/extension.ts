// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileTreeProvider } from './fileTree';
import { ProfileManager } from './profileManager';
import { SearchWebviewProvider } from './searchWebviewProvider';
import { executeRepomix, showRepomixResult, RepomixOptions, getOutputChannel } from './repomixRunner';

import * as path from 'path';
import * as childProcess from 'child_process';
import * as util from 'util';

// Profile type definition
interface Profile {
  name: string;
  checkedPaths: string[];
}

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Repomix Extension is now active!');
  console.log('Extension URI:', context.extensionUri.toString());
  
  // Get workspace directory
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
  
  // Create instances of providers
  const fileTreeProvider = new FileTreeProvider(workspaceRoot, context);
  const profileManager = new ProfileManager(context);
  const searchWebviewProvider = new SearchWebviewProvider(context);
  
  // Connect search provider with file tree
  searchWebviewProvider.setOnSearchChange((query) => {
    fileTreeProvider.setSearchQuery(query);
  });
  
  // Register search webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SearchWebviewProvider.viewType,
      searchWebviewProvider
    )
  );
  
  // Register file tree view
  const treeView = vscode.window.createTreeView('repomixFileExplorer', {
    treeDataProvider: fileTreeProvider,
    showCollapseAll: true
  });
  
  // Register profile manager view
  vscode.window.registerTreeDataProvider('repomixProfiles', profileManager);

  // Register toggle command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.toggleChecked', (item: any) => {
      fileTreeProvider.toggleChecked(item);
    })
  );

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.refresh', async () => {
      await fileTreeProvider.refresh();
      vscode.window.showInformationMessage('File tree refreshed with repomix patterns');
    })
  );

  // Register Select All command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.selectAll', async () => {
      await fileTreeProvider.selectAll();
      const query = fileTreeProvider.getSearchQuery();
      if (query) {
        vscode.window.showInformationMessage(`All files matching "${query}" selected`);
      } else {
        vscode.window.showInformationMessage('All files and folders selected');
      }
    })
  );
  
  
  // Register search clear command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.clearSearch', () => {
      fileTreeProvider.setSearchQuery('');
      vscode.window.showInformationMessage('Search filter cleared');
    })
  );

  // Register save profile command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.saveProfile', async () => {
      const profileName = await vscode.window.showInputBox({
        title: 'Enter profile name',
        placeHolder: 'e.g. project-a-config',
      });

      if (profileName) {
        // Get selected file paths
        const checkedItems = fileTreeProvider.getCheckedItems();
        
        // Save profile using ProfileManager
        const savedProfile = profileManager.saveProfile(profileName, checkedItems);
        
        vscode.window.showInformationMessage(`Profile "${profileName}" saved successfully.`);
      }
    })
  );


  // Register load profile command (maintain legacy command)
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.loadProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // Check if called from TreeView
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // Get saved profile list
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // Select profile
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
        // Load selected profile
        const profile = profileManager.loadProfile(profileName);
        
        if (profile) {
          // Reset file tree selection state
          fileTreeProvider.uncheckAll();
          
          // Set saved paths to selected state
          for (const path of profile.paths) {
            fileTreeProvider.setChecked(path, true, false);
          }
          
          // Update tree view (without clearing selection state)
          fileTreeProvider.updateView();
          
          vscode.window.showInformationMessage(`Profile "${profileName}" loaded successfully.`);
        }
      }
    })
  );

  // Register profile rename command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.renameProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // Check if called from TreeView
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // Get saved profile list
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // Select profile to rename
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
        // Enter new name
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

  // Register profile delete command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.deleteProfile', async (profileItem?: any) => {
      let profileName: string | undefined;
      
      // Check if called from TreeView
      if (profileItem && profileItem.profile && profileItem.profile.name) {
        profileName = profileItem.profile.name;
      } else {
        // Get saved profile list
        const profiles = profileManager.getProfiles();
        
        if (profiles.length === 0) {
          vscode.window.showInformationMessage('No saved profiles found.');
          return;
        }
        
        // Select profile to delete
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
        // Show confirmation dialog
        const confirmed = await vscode.window.showWarningMessage(
          `Delete profile "${profileName}"?`, 
          { modal: true },
          'Delete'
        );
        
        if (confirmed === 'Delete') {
          // Delete profile using ProfileManager
          const deleted = profileManager.deleteProfile(profileName);
          
          if (deleted) {
            vscode.window.showInformationMessage(`Profile "${profileName}" deleted successfully.`);
          }
        }
      }
    })
  );

  // Register repomix execution command
  context.subscriptions.push(
    vscode.commands.registerCommand('repomix-extension.executeRepomix', async () => {
      const checkedPaths = fileTreeProvider.getCheckedItems();
      
      if (checkedPaths.length === 0) {
        vscode.window.showWarningMessage('No files selected. Please select files to execute.');
        return;
      }
      
      try {
        // Use withProgress to show a progress notification
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Executing Repomix...',
          cancellable: false
        }, async (progress) => {
          // Get workspace root
          const wsRoot = fileTreeProvider.getWorkspaceRoot();
          
          // Get path information for selected files
          const fileInfo = checkedPaths.map(filePath => {
            // Calculate relative path from working directory
            const relativePath = path.relative(wsRoot, filePath);
            return {
              fullPath: filePath,
              relativePath: relativePath
            };
          });

          // Build repomix execution options
          const repomixOptions: RepomixOptions = {
            files: fileInfo.map(f => f.relativePath),
            workspaceRoot: wsRoot,
            additionalOptions: {
              // Additional options can be set if needed
            }
          };
          
          // Execute repomix and get results
          const result = await executeRepomix(repomixOptions);
          
          // Open generated XML file
          await showRepomixResult(repomixOptions);
          
          // Show notification based on execution result
          if (result.success) {
            // Update progress message to show completion
            progress.report({ 
              increment: 100, 
              message: `Completed! Processed ${fileInfo.length} files.` 
            });
            
            // Wait a moment to ensure user sees the success message
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Show success message with action to view logs
            const action = await vscode.window.showInformationMessage(
              `Repomix completed successfully! Processed ${fileInfo.length} files in ${result.executionTimeMs}ms.`,
              'Show Logs'
            );
            
            if (action === 'Show Logs') {
              getOutputChannel().show();
            }
          } else {
            // Show error message with action to view logs
            const action = await vscode.window.showErrorMessage(
              `Repomix execution failed: ${result.error}`,
              'Show Logs'
            );
            
            if (action === 'Show Logs') {
              getOutputChannel().show();
            }
          }
        });
      } catch (error) {
        console.error('Error executing repomix:', error);
        vscode.window.showErrorMessage(`Failed to execute Repomix: ${error}`);
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
