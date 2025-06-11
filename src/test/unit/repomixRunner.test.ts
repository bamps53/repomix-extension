import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { executeRepomix, RepomixOptions, showRepomixResult } from '../../repomixRunner';

suite('RepomixRunner Tests', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('executeRepomix should return success result with mock data', async () => {
    // テスト用のオプション
    const options: RepomixOptions = {
      files: ['test/file1.txt', 'test/file2.txt'],
      workspaceRoot: '/test/workspace'
    };

    // 実行
    const result = await executeRepomix(options);

    // 検証
    assert.strictEqual(result.success, true, 'Repomix execution should succeed');
    assert.ok(result.output.includes('処理ファイル数: 2'), 'Output should contain file count');
    assert.ok(result.output.includes('test/file1.txt'), 'Output should contain file1');
    assert.ok(result.output.includes('test/file2.txt'), 'Output should contain file2');
    assert.ok(result.executionTimeMs !== undefined, 'Execution time should be measured');
  });

  test('executeRepomix should handle empty file list', async () => {
    // 空のファイルリスト
    const options: RepomixOptions = {
      files: [],
      workspaceRoot: '/test/workspace'
    };

    // 実行
    const result = await executeRepomix(options);

    // 検証
    assert.strictEqual(result.success, true, 'Should succeed with empty file list');
    assert.ok(result.output.includes('処理ファイル数: 0'), 'Output should show zero files');
  });

  test('showRepomixResult should open editor with success result', async () => {
    // モックの準備
    const mockDocument = {};
    const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();

    // テスト用の結果データ
    const result = {
      success: true,
      output: '# テスト結果\n\n成功しました',
      timestamp: new Date(),
      executionTimeMs: 100,
      error: undefined
    };

    // 実行
    await showRepomixResult(result);

    // 検証
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should call openTextDocument once');
    assert.strictEqual(showTextDocumentStub.calledOnce, true, 'Should call showTextDocument once');
    
    // 型エラー回避のために引数の存在を確認
    const firstCallArgs = openTextDocumentStub.firstCall?.args?.[0];
    assert.ok(firstCallArgs, 'openTextDocument should have been called with arguments');
    assert.strictEqual(firstCallArgs.content, '# テスト結果\n\n成功しました', 'Content should match');
    assert.strictEqual(firstCallArgs.language, 'markdown', 'Language should be markdown');
  });

  test('showRepomixResult should open editor with error result', async () => {
    // モックの準備
    const mockDocument = {};
    const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();

    // テスト用のエラー結果
    const result = {
      success: false,
      output: '',
      error: 'テストエラー',
      timestamp: new Date(),
      executionTimeMs: 50
    };

    // 実行
    await showRepomixResult(result);

    // 検証
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should call openTextDocument once');
    
    const firstCallArgs = openTextDocumentStub.firstCall?.args?.[0];
    assert.ok(firstCallArgs, 'openTextDocument should have been called with arguments');
    assert.ok(
      firstCallArgs.content && firstCallArgs.content.includes('テストエラー'), 
      'Should include error message in content'
    );
  });

  test('showRepomixResult should handle exceptions', async () => {
    // モックの準備
    const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument')
      .throws(new Error('テスト例外'));
    const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    // テスト用の結果データ
    const result = {
      success: true,
      output: '# テスト結果',
      timestamp: new Date(),
      executionTimeMs: 100
    };

    // 実行
    await showRepomixResult(result);

    // 検証
    assert.strictEqual(showErrorMessageStub.calledOnce, true, 'Should show error message');
    assert.ok(showErrorMessageStub.firstCall.args[0].includes('失敗'), 'Error message should indicate failure');
  });
});
