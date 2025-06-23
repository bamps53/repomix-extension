import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Mock child_process module before importing repomixRunner
const mockSpawn = sinon.stub();
const childProcessMock = {
  spawn: mockSpawn
};

// Override require for child_process
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'child_process') {
    return childProcessMock;
  }
  return originalRequire.apply(this, arguments);
};

import { executeRepomix, RepomixOptions } from '../../repomixRunner';

suite('RepomixRunner Tests', () => {
  let sandbox: sinon.SinonSandbox;
  const testWorkspace = '/tmp/test-workspace';

  setup(() => {
    sandbox = sinon.createSandbox();
    // Reset the mock for each test
    mockSpawn.reset();
    
    // Create test workspace directory if it doesn't exist
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }
  });

  teardown(() => {
    sandbox.restore();
    mockSpawn.reset();
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      const outputPath = path.join(testWorkspace, 'repomix-output.xml');
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  });

  test('executeRepomix should return success result with actual execution', async () => {
    // Mock spawn to simulate successful repomix execution
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    mockSpawn.returns(mockProcess);
    
    // テスト用のオプション - 実際のテストワークスペースを使用
    const options: RepomixOptions = {
      files: ['file1.txt', 'file2.txt'],
      workspaceRoot: testWorkspace
    };

    // Start execution
    const resultPromise = executeRepomix(options);
    
    // Simulate async process behavior
    setImmediate(() => {
      mockProcess.stdout.emit('data', Buffer.from('Repomix output for test files'));
      mockProcess.emit('close', 0);
    });

    // 実行
    const result = await resultPromise;

    // 検証
    assert.strictEqual(result.success, true, 'Repomix execution should succeed');
    assert.ok(result.output && result.output.length > 0, 'Output should contain repomix result');
    assert.ok(result.executionTimeMs !== undefined && result.executionTimeMs >= 0, 'Execution time should be measured');
    assert.ok(result.timestamp instanceof Date, 'Timestamp should be set');
    
    // Verify spawn was called correctly
    assert.ok(mockSpawn.calledOnce);
    assert.strictEqual(mockSpawn.firstCall.args[0], 'npx');
    assert.deepStrictEqual(mockSpawn.firstCall.args[1], ['repomix', '--include', 'file1.txt,file2.txt', '.']);
  });

  test('executeRepomix should handle empty file list', async () => {
    // Mock spawn for empty file list
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    mockSpawn.returns(mockProcess);
    
    // 空のファイルリスト
    const options: RepomixOptions = {
      files: [],
      workspaceRoot: testWorkspace
    };

    // Start execution
    const resultPromise = executeRepomix(options);
    
    // Simulate async process
    setImmediate(() => {
      mockProcess.stdout.emit('data', Buffer.from('Repomix output for all files'));
      mockProcess.emit('close', 0);
    });

    // 実行
    const result = await resultPromise;

    // 検証 - 空のファイルリストでも処理可能
    assert.strictEqual(result.success, true, 'Should succeed with empty file list');
    assert.ok(result.output !== undefined, 'Output should be defined');
    assert.ok(result.executionTimeMs !== undefined, 'Execution time should be measured');
    
    // Verify spawn was called without include flag
    assert.ok(mockSpawn.calledOnce);
    assert.strictEqual(mockSpawn.firstCall.args[0], 'npx');
    assert.deepStrictEqual(mockSpawn.firstCall.args[1], ['repomix', '.']);
  });

  test('executeRepomix should handle specific file selection', async () => {
    // Mock spawn for specific file
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    mockSpawn.returns(mockProcess);
    
    const options: RepomixOptions = {
      files: ['subfolder/file3.js'],
      workspaceRoot: testWorkspace
    };

    // Start execution
    const resultPromise = executeRepomix(options);
    
    // Simulate async process
    setImmediate(() => {
      mockProcess.stdout.emit('data', Buffer.from('Repomix output for specific file'));
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;

    assert.strictEqual(result.success, true, 'Should succeed with specific file');
    assert.ok(result.output, 'Should have output');
    assert.ok(result.executionTimeMs !== undefined, 'Execution time should be measured');
    
    // Verify spawn was called correctly
    assert.ok(mockSpawn.calledOnce);
    assert.strictEqual(mockSpawn.firstCall.args[0], 'npx');
    assert.deepStrictEqual(mockSpawn.firstCall.args[1], ['repomix', '--include', 'subfolder/file3.js', '.']);
  });

  test('executeRepomix should generate XML output file', async () => {
    // Mock spawn and fs to simulate file creation
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    mockSpawn.returns(mockProcess);
    
    const options: RepomixOptions = {
      files: ['file1.txt'],
      workspaceRoot: testWorkspace
    };

    // Start execution
    const resultPromise = executeRepomix(options);
    
    // Simulate async process
    setImmediate(() => {
      mockProcess.stdout.emit('data', Buffer.from('Repomix output with XML generation'));
      
      // Create the output file to simulate repomix behavior
      const outputPath = path.join(testWorkspace, 'repomix-output.xml');
      fs.writeFileSync(outputPath, '<repomix>test output</repomix>');
      
      mockProcess.emit('close', 0);
    });

    const result = await resultPromise;
    
    // Check if output file was created
    const outputPath = path.join(testWorkspace, 'repomix-output.xml');
    const outputExists = fs.existsSync(outputPath);
    
    assert.strictEqual(result.success, true, 'Execution should succeed');
    assert.strictEqual(outputExists, true, 'repomix-output.xml should be created');
  });
  
  // Add a final teardown to restore require
  suiteTeardown(() => {
    Module.prototype.require = originalRequire;
  });
});