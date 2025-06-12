# VS Code Marketplace Publishing Guide

このドキュメントでは、Repomix Controller拡張機能をVS Code Marketplaceに公開する手順を説明します。

## 前提条件

- Node.js と npm がインストールされている
- `vsce` (Visual Studio Code Extension) CLIツールがインストールされている
- Azure DevOps アカウントを持っている

## 1. 事前準備

### 1.1 必要なツールのインストール

```bash
npm install -g @vscode/vsce
```

### 1.2 拡張機能のビルド

```bash
npm run compile
npm run lint
npm run test:unit  # 全テストが通ることを確認
```

## 2. Azure DevOps セットアップ

### 2.1 Azure DevOps アカウント作成

1. https://dev.azure.com にアクセス
2. Microsoft アカウントでサインインまたはアカウント作成

### 2.2 Personal Access Token (PAT) の作成

1. Azure DevOps にログイン
2. 右上のユーザーアイコン → **Personal access tokens**
3. **New Token** をクリック
4. 以下の設定でトークンを作成：
   - **Name**: `VS Code Publishing`
   - **Organization**: `All accessible organizations`
   - **Expiration**: 適切な期間を選択（1年など）
   - **Scopes**: `Custom defined` を選択
   - **Marketplace** → **Manage** にチェック
5. **Create** をクリック
6. ⚠️ **重要**: 表示されたトークンをコピーして安全な場所に保存（一度しか表示されません）

## 3. Publisher アカウント作成

### 3.1 Marketplace でPublisher作成

1. https://marketplace.visualstudio.com/manage にアクセス
2. **Create publisher** をクリック
3. Publisher情報を入力：
   - **Publisher ID**: `daisuke` (package.jsonのpublisherと一致させる)
   - **Publisher display name**: 任意の表示名
   - **Description**: 簡単な説明
4. **Create** をクリック

## 4. vsce ログイン

### 4.1 環境変数でPATを設定

```bash
export VSCE_PAT=your-personal-access-token-here
```

### 4.2 vsceにログイン

```bash
vsce login daisuke
```

成功すると以下のメッセージが表示されます：
```
The Personal Access Token verification succeeded for the publisher 'daisuke'.
```

## 5. 公開前の準備

### 5.1 package.json の確認

以下の項目が正しく設定されていることを確認：

```json
{
  "name": "repomix-extension",
  "displayName": "Repomix Controller",
  "description": "VSCode extension to intuitively operate Repomix CLI from GUI",
  "version": "0.0.2",
  "publisher": "daisuke",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/bamps53/repomix-extension.git"
  },
  "keywords": [
    "repomix",
    "code-generation",
    "file-tree",
    "repository",
    "cli-tool",
    "developer-tools"
  ],
  "categories": [
    "Other",
    "Developer Tools",
    "Productivity"
  ],
  "engines": {
    "vscode": "^1.74.0"
  }
}
```

### 5.2 必須ファイルの確認

- `LICENSE` ファイルが存在する
- `README.md` が更新されている
- アイコンファイル（`resources/repomix-icon.svg`）が存在する

## 6. パッケージ作成とテスト

### 6.1 VSIX パッケージの作成

```bash
vsce package
```

成功すると `repomix-extension-x.x.x.vsix` ファイルが作成されます。

### 6.2 ローカルテスト

VSIXファイルをローカルでインストールしてテスト：

1. VS Code を開く
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. 作成されたVSIXファイルを選択
4. 拡張機能の動作を確認

## 7. Marketplace への公開

### 7.1 公開コマンド

```bash
vsce publish
```

または、特定のバージョンで公開：

```bash
vsce publish 0.0.2
```

### 7.2 公開後の確認

1. https://marketplace.visualstudio.com で拡張機能を検索
2. 拡張機能ページが正しく表示されるか確認
3. VS Code内で検索・インストールできるか確認

## 8. バージョン管理

### 8.1 セマンティックバージョニング

- **patch** (0.0.x): バグ修正
- **minor** (0.x.0): 新機能追加（後方互換性あり）
- **major** (x.0.0): 破壊的変更

### 8.2 バージョンアップ公開

```bash
# パッチバージョンアップ
vsce publish patch

# マイナーバージョンアップ
vsce publish minor

# メジャーバージョンアップ
vsce publish major
```

## 9. トラブルシューティング

### 9.1 よくある問題

1. **認証エラー**
   ```
   ERROR The Personal Access Token verification has failed
   ```
   - PATの権限を確認（Marketplace → Manage）
   - Publisher IDが正しいか確認

2. **バージョンエラー**
   ```
   ERROR @types/vscode greater than engines.vscode
   ```
   - `@types/vscode` のバージョンを `engines.vscode` と一致させる

3. **ファイル不足エラー**
   - `LICENSE` ファイルが存在するか確認
   - `README.md` が適切に記述されているか確認

### 9.2 デバッグコマンド

```bash
# パッケージ内容の確認
vsce ls

# パッケージ情報の表示
vsce show repomix-extension

# 公開されているバージョンの確認
vsce show daisuke.repomix-extension
```

## 10. 継続的統合（CI/CD）

GitHub Actions を使用した自動公開の設定例：

```yaml
name: Publish Extension
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run test:unit
      - run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
```

## 参考リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)