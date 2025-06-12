import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { executeRepomix, RepomixOptions } from '../../repomixRunner';

suite('RepomixRunner Tests', () => {
  let sandbox: sinon.SinonSandbox;
  const testWorkspace = '/tmp/test-workspace';

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('executeRepomix should return success result with actual execution', async () => {
    // テスト用のオプション - 実際のテストワークスペースを使用
    const options: RepomixOptions = {
      files: ['file1.txt', 'file2.txt'],
      workspaceRoot: testWorkspace
    };

    // 実行
    const result = await executeRepomix(options);

    // 検証
    assert.strictEqual(result.success, true, 'Repomix execution should succeed');
    assert.ok(result.output && result.output.length > 0, 'Output should contain repomix result');
    assert.ok(result.executionTimeMs !== undefined && result.executionTimeMs >= 0, 'Execution time should be measured');
    assert.ok(result.timestamp instanceof Date, 'Timestamp should be set');
  });

  test('executeRepomix should handle empty file list', async () => {
    // 空のファイルリスト
    const options: RepomixOptions = {
      files: [],
      workspaceRoot: testWorkspace
    };

    // 実行
    const result = await executeRepomix(options);

    // 検証 - 空のファイルリストでも処理可能
    assert.strictEqual(result.success, true, 'Should succeed with empty file list');
    assert.ok(result.output !== undefined, 'Output should be defined');
    assert.ok(result.executionTimeMs !== undefined, 'Execution time should be measured');
  });

  test('executeRepomix should handle specific file selection', async () => {
    const options: RepomixOptions = {
      files: ['subfolder/file3.js'],
      workspaceRoot: testWorkspace
    };

    const result = await executeRepomix(options);

    assert.strictEqual(result.success, true, 'Should succeed with specific file');
    assert.ok(result.output, 'Should have output');
    assert.ok(result.executionTimeMs !== undefined, 'Execution time should be measured');
  });

  test('executeRepomix should generate XML output file', async () => {
    const options: RepomixOptions = {
      files: ['file1.txt'],
      workspaceRoot: testWorkspace
    };

    const result = await executeRepomix(options);
    
    // Check if output file was created
    const outputPath = path.join(testWorkspace, 'repomix-output.xml');
    const outputExists = fs.existsSync(outputPath);
    
    assert.strictEqual(result.success, true, 'Execution should succeed');
    assert.strictEqual(outputExists, true, 'repomix-output.xml should be created');
    
    // Clean up output file after test
    if (outputExists) {
      fs.unlinkSync(outputPath);
    }
  });
});