# Repomix Controller

Repomix Controller は、repomix CLI ツールのための VSCode 拡張機能です。ファイル選択状態の管理、プロファイルによる選択状態の保存/読み込み、そして選択されたファイルに対する repomix コマンドの実行を視覚的に行うことができます。

## 主な機能

### ファイルツリービュー
- ワークスペース内のファイルをツリー形式で表示
- チェックボックス付きのファイル選択インターフェース
- ディレクトリの再帰的選択をサポート
- カスタムアイコンによる視覚的表示

### プロファイル管理
- 選択したファイルの状態をプロファイルとして保存
- 保存したプロファイルの読み込み
- プロファイルの削除・リネーム機能
- 専用のプロファイル管理ビューで一覧表示
- 右クリックメニューからのプロファイル操作

### repomix 実行
- 選択したファイルリストに対して repomix を実行
- 実際の npx repomix コマンドを使用した実行
- 生成された repomix-output.xml ファイルの自動表示
- 実行時間の測定と結果表示

## 必要条件

- Visual Studio Code 1.74.0 以上
- Node.js 16.x 以上
- repomix CLI ツール（`npm install -g repomix` でインストール）

## 使い方

### インストールと初期設定
1. 拡張機能をインストール後、repomix CLI ツールをインストール：
   ```bash
   npm install -g repomix
   ```
2. VSCode のアクティビティバーから Repomix アイコンをクリック
3. File Tree と Profiles の2つのビューが表示されます

### ファイル選択
1. **File Tree** ビューでワークスペース内のファイルを表示
2. ファイルやフォルダをクリックしてチェックボックスで選択
3. フォルダを選択すると、その中のすべてのファイルが再帰的に選択される
4. 選択状態は視覚的にアイコンで表示されます

### プロファイル管理
1. ファイル選択後、File Tree ビュー上部の「Save Profile」ボタン（+）をクリック
2. プロファイル名を入力して保存
3. 保存したプロファイルは **Profiles** ビューに表示される
4. プロファイルの操作：
   - **読み込み**: プロファイルをクリックまたは右クリック→「Load Profile」
   - **リネーム**: 右クリック→「Rename Profile」
   - **削除**: 右クリック→「Delete Profile」

### repomix の実行
1. ファイル選択後、File Tree ビュー上部の実行ボタン（▶）をクリック
2. または、コマンドパレット（`Ctrl+Shift+P`）から「Execute Repomix」を選択
3. 選択されたファイルに対して repomix が実行される
4. 生成された `repomix-output.xml` ファイルが自動で開かれる
5. 実行時間と処理結果がステータスバーに表示される

## 利用可能なコマンド

拡張機能では以下のコマンドが利用できます：

- `repomix-extension.refresh` - ファイルツリーを更新
- `repomix-extension.executeRepomix` - 選択したファイルでRepomixを実行
- `repomix-extension.saveProfile` - 現在の選択状態をプロファイルとして保存
- `repomix-extension.loadProfile` - プロファイルを読み込み
- `repomix-extension.renameProfile` - プロファイル名を変更
- `repomix-extension.deleteProfile` - プロファイルを削除
- `repomix-extension.toggleChecked` - ファイル/フォルダの選択状態を切り替え

## 既知の問題

- 非常に大きなディレクトリ構造でのパフォーマンス低下の可能性
- repomix CLI ツールがインストールされていない場合のエラーハンドリング

## リリースノート

### 0.0.1

初回リリース
- ファイルツリービューとチェックボックス選択
- プロファイル管理（保存/読み込み/削除/リネーム）
- 実際の repomix CLI との統合
- 専用プロファイル管理ビュー
- 包括的なテストスイート（49テスト）
- GitHub Actions CI/CD パイプライン

---

## 開発情報

### 技術スタック
- TypeScript 5.8+
- VSCode Extension API 1.74+
- Webpack（バンドル）
- Mocha, Chai, Sinon（テスト）

### アーキテクチャ
- `extension.ts`: 拡張機能のエントリーポイントとコマンド登録
- `fileTree.ts`: ファイルシステムツリービュープロバイダー
- `profileManager.ts`: プロファイル保存・管理機能
- `repomixRunner.ts`: repomixコマンド実行とXMLファイル処理

### テスト構成
- `npm run test:unit` - 単体テスト（49テスト）
- `npm test` - VS Code統合テスト
- 実際のrepomix実行を含むテスト
- CI環境での自動テスト実行

## 詳細情報

* [VSCode 拡張機能開発ドキュメント](https://code.visualstudio.com/api)
* [GitHub リポジトリ](https://github.com/yourusername/repomix-extension)

## ライセンス

MIT

**Repomix Controller をお楽しみください！**
