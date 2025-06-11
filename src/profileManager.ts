import * as vscode from 'vscode';

/**
 * プロファイルの型定義
 */
export interface Profile {
  name: string;
  paths: string[];
  createdAt: number;
}

/**
 * プロファイル管理のためのクラス
 * VSCodeのTreeDataProviderを実装し、保存されたプロファイルをツリービューで表示する
 */
export class ProfileManager implements vscode.TreeDataProvider<ProfileItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProfileItem | undefined | null | void> =
    new vscode.EventEmitter<ProfileItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ProfileItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * プロファイルを保存する
   * @param name プロファイル名
   * @param paths 選択されたファイルパスの配列
   * @returns 保存されたプロファイル
   */
  saveProfile(name: string, paths: string[]): Profile {
    const profiles = this.getProfiles();
    
    // 既存のプロファイルがあれば上書き、なければ新規作成
    const existingProfileIndex = profiles.findIndex((profile) => profile.name === name);
    const profile: Profile = {
      name,
      paths,
      createdAt: Date.now(),
    };

    if (existingProfileIndex !== -1) {
      profiles[existingProfileIndex] = profile;
    } else {
      profiles.push(profile);
    }

    this.context.workspaceState.update('repomix.profiles', profiles);
    this._onDidChangeTreeData.fire();
    
    return profile;
  }

  /**
   * プロファイルを読み込む
   * @param name プロファイル名
   * @returns 読み込まれたプロファイル、存在しない場合はundefined
   */
  loadProfile(name: string): Profile | undefined {
    const profiles = this.getProfiles();
    return profiles.find((profile) => profile.name === name);
  }

  /**
   * プロファイルを削除する
   * @param name プロファイル名
   * @returns 削除に成功した場合はtrue
   */
  deleteProfile(name: string): boolean {
    const profiles = this.getProfiles();
    const initialLength = profiles.length;
    const filteredProfiles = profiles.filter((profile) => profile.name !== name);
    
    if (filteredProfiles.length !== initialLength) {
      this.context.workspaceState.update('repomix.profiles', filteredProfiles);
      this._onDidChangeTreeData.fire();
      return true;
    }
    
    return false;
  }

  /**
   * 保存されているプロファイルの一覧を取得する
   */
  getProfiles(): Profile[] {
    return this.context.workspaceState.get<Profile[]>('repomix.profiles', []);
  }

  /**
   * ツリーアイテムの子要素を取得する（TreeDataProviderインターフェースの実装）
   */
  getChildren(): ProfileItem[] {
    const profiles = this.getProfiles();
    return profiles.map((profile) => new ProfileItem(profile));
  }

  /**
   * ツリーアイテムを取得する（TreeDataProviderインターフェースの実装）
   */
  getTreeItem(element: ProfileItem): vscode.TreeItem {
    return element;
  }

  /**
   * ツリービューを更新する
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

/**
 * プロファイルのツリーアイテム
 */
export class ProfileItem extends vscode.TreeItem {
  constructor(public readonly profile: Profile) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);
    
    this.tooltip = `${profile.name} (${profile.paths.length} files)`;
    this.description = new Date(profile.createdAt).toLocaleString();
    
    this.iconPath = new vscode.ThemeIcon('bookmark');
    
    this.contextValue = 'profile';
  }
}
