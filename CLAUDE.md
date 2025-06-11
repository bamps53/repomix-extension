# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run compile` - Compile TypeScript to JavaScript using webpack
- `npm run watch` - Watch mode for development with auto-recompilation
- `npm run package` - Production build with hidden source maps
- `npm run vscode:prepublish` - Prepare for VS Code extension publishing

### Testing
- `npm test` - Run all tests using VS Code test runner
- `npm run compile-tests` - Compile test files to `out/` directory
- `npm run watch-tests` - Watch mode for test compilation
- `npm run pretest` - Full test preparation (compile tests, compile extension, lint)

### Code Quality
- `npm run lint` - Run ESLint on `src/` directory
- Code formatting uses Prettier with single quotes, 2-space tabs, 100 char width

## Architecture Overview

This is a VS Code extension for Repomix integration with a custom file tree selection interface.

### Core Components

**Extension Entry Point** (`src/extension.ts`)
- Main activation function that registers all commands and providers
- Manages workspace state for profile persistence
- Handles Repomix execution and file selection coordination

**File Tree Provider** (`src/fileTree.ts`)
- Custom `TreeDataProvider` implementation for VS Code tree view
- Manages file/folder selection state with checkboxes
- Supports recursive directory selection
- Provides methods to get selected file URIs

**Key Features**
- Custom tree view (`repomixFileExplorer`) showing workspace files with checkboxes
- Profile system to save/load file selections
- Repomix execution with selected files (currently mocked)
- Recursive directory selection

### Extension Architecture

The extension follows VS Code's standard extension pattern:
- `activate()` function registers all commands and providers
- TreeDataProvider pattern for custom tree views
- Command registration using `vscode.commands.registerCommand`
- Workspace state management for persistence

### File Organization

- `src/extension.ts` - Main extension logic and command handlers
- `src/fileTree.ts` - File tree provider and selection management
- `src/test/` - Test files using Mocha framework
- `src/webview/` - React components for webview (components/ and hooks/ directories)
- `dist/` - Compiled output directory

### Build System

Uses webpack for bundling with TypeScript compilation:
- Entry point: `src/extension.ts`
- Output: `dist/extension.js`
- Target: Node.js (VS Code extension host)
- External: `vscode` module (provided by VS Code)

### Testing Framework

- Mocha test runner with VS Code test utilities
- Test files in `src/test/` with `.test.ts` extension
- Uses `@vscode/test-cli` and `@vscode/test-electron`
- Chai assertions and Sinon for mocking

## Development Notes

- Extension includes Japanese comments and messages in the main code
- Uses React for webview components (v19.1.0)
- Profile loading functionality is marked as TODO in `extension.ts:105`
- Repomix execution is currently mocked in `extension.ts:163`