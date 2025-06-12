import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: [
    'out/test/extension.test.js',
    'out/test/integration.test.js'
  ],
  workspaceFolder: './test-fixtures',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
  launchArgs: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions-except=${workspaceFolder}',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ],
  env: {
    NODE_ENV: 'test'
  }
});