# Repomix Controller

Repomix Controller は、repomix CLI ツールのための VSCode 拡張機能です。ファイル選択状態の管理、プロファイルによる選択状態の保存/読み込み、そして選択されたファイルに対する repomix コマンドの実行を視覚的に行うことができます。

## 主な機能

### ファイルツリービュー
- ワークスペース内のファイルをツリー形式で表示
- チェックボックス付きのファイル選択インターフェース
- ディレクトリの再帰的選択をサポート

### プロファイル管理
- 選択したファイルの状態をプロファイルとして保存
- 保存したプロファイルの読み込み
- プロファイルの削除と管理

### repomix 実行
- 選択したファイルリストに対して repomix を実行
- 実行結果をマークダウンエディタで表示
- 実行オプションの柔軟な設定

## 必要条件

- Visual Studio Code 1.100.0 以上
- Node.js 16.x 以上（開発時のみ）
- TypeScript 5.8.0 以上（開発時のみ）

## 拡張機能の設定

この拡張機能は以下の設定項目を提供します：

* `repomix-extension.autoSaveProfiles`: プロファイルの自動保存を有効/無効にします
* `repomix-extension.defaultProfileName`: 新規プロファイル作成時のデフォルト名接頭辞
* `repomix-extension.showConfirmationDialogs`: 確認ダイアログの表示/非表示を設定

## 使い方

### ファイル選択
1. VSCode のアクティビティバーから Repomix Controller アイコンをクリック
2. ファイルツリービューで選択したいファイルをクリックしてチェックを入れる
3. ディレクトリを選択すると、そのディレクトリ内のすべてのファイルが選択される

### プロファイル管理
1. ファイル選択後、コマンドパレット(`Ctrl+Shift+P`)から「Repomix: プロファイルを保存」を選択
2. プロファイル名を入力して保存
3. 保存したプロファイルは「プロファイル管理」ビューに表示
4. プロファイルをクリックすると読み込み、右クリックで削除も可能

### repomix の実行
1. ファイル選択後、ファイルツリービュー上部の実行ボタン(▶)をクリック
2. または、コマンドパレットから「Repomix: 実行」を選択
3. 実行結果が新しいエディタタブに表示される

## 既知の問題

* 非常に大きなディレクトリ構造でのパフォーマンス低下
* 一部特殊文字を含むファイル名での選択状態の問題

## リリースノート

### 0.1.0

初回リリース
* ファイルツリービュー
* チェックボックス付きファイル選択
* プロファイル管理（保存/読み込み/削除）
* repomix 実行機能（モック実装）

---

## 開発情報

### 技術スタック
* TypeScript
* React
* VSCode Extension API
* Mocha, Chai, Sinon（テスト）

### アーキテクチャ
* `extension.ts`: 拡張機能のエントリーポイント
* `fileTree.ts`: ファイルシステムをツリービューで表示する機能
* `profileManager.ts`: プロファイル管理機能
* `repomixRunner.ts`: repomixコマンド実行機能

### テスト
* `npm test` コマンドでユニットテストを実行
* VSCode Extension Testing APIを使用した統合テスト

## 詳細情報

* [VSCode 拡張機能開発ドキュメント](https://code.visualstudio.com/api)
* [GitHub リポジトリ](https://github.com/yourusername/repomix-extension)

## ライセンス

MIT

**Repomix Controller をお楽しみください！**
