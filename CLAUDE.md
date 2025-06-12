# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run compile` - Compile TypeScript to JavaScript using webpack
- `npm run watch` - Watch mode for development with auto-recompilation
- `npm run package` - Production build with hidden source maps
- `npm run vscode:prepublish` - Prepare for VS Code extension publishing

### Testing
- `npm test` - Run VS Code extension integration tests
- `npm run test:unit` - Run unit tests with Mocha (49 tests)
- `npm run test:mocha` - Run tests with custom mocha config
- `npm run compile-tests` - Compile test files to `out/` directory
- `npm run watch-tests` - Watch mode for test compilation
- `npm run pretest` - Full test preparation (compile tests, compile extension, lint)

### Code Quality
- `npm run lint` - Run ESLint on `src/` directory
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
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
- Manages file/folder selection state with checkboxes and custom icons
- Supports recursive directory selection with event handling
- Provides methods to get selected file URIs and toggle states

**Profile Manager** (`src/profileManager.ts`)
- Implements `TreeDataProvider` for profile management view
- Workspace state persistence for profile storage
- Profile CRUD operations (create, read, update, delete, rename)
- Profile item rendering with metadata (file count, creation date)

**Repomix Runner** (`src/repomixRunner.ts`)
- Actual integration with npx repomix CLI command
- Execution time measurement and result handling
- XML output file automatic opening in VS Code
- Error handling for missing repomix installation

**Key Features**
- Dual tree view system (`repomixFileExplorer` and `repomixProfiles`)
- Profile system with save/load/delete/rename operations
- Real repomix execution with selected files (not mocked)
- Comprehensive test suite with actual repomix execution

### Extension Architecture

The extension follows VS Code's standard extension pattern:
- `activate()` function registers all commands and providers
- TreeDataProvider pattern for custom tree views
- Command registration using `vscode.commands.registerCommand`
- Workspace state management for persistence

### File Organization

- `src/extension.ts` - Main extension logic and command handlers
- `src/fileTree.ts` - File tree provider and selection management
- `src/profileManager.ts` - Profile management and tree data provider
- `src/repomixRunner.ts` - Repomix CLI integration and execution
- `src/test/` - Test files using Mocha framework
  - `src/test/unit/` - Unit tests with comprehensive coverage
  - `src/test/integration.test.ts` - VS Code extension integration tests
  - `src/test/mocks/` - Mock implementations for testing
- `src/webview/` - React components for webview (components/ and hooks/ directories)
- `dist/` - Compiled output directory
- `out/` - TypeScript compiled test output

### Build System

Uses webpack for bundling with TypeScript compilation:
- Entry point: `src/extension.ts`
- Output: `dist/extension.js`
- Target: Node.js (VS Code extension host)
- External: `vscode` module (provided by VS Code)

### Testing Framework

- **Unit Tests**: Mocha test runner with 49 comprehensive tests
- **Integration Tests**: VS Code extension testing with real API
- **Actual Execution Tests**: Real repomix CLI command execution in tests
- Test files in `src/test/` with organized structure:
  - Unit tests with mocked VS Code APIs (`test-setup.js`)
  - Integration tests with real VS Code environment
  - Error handling and performance test scenarios
- Uses `@vscode/test-cli`, `@vscode/test-electron`, Chai, and Sinon
- GitHub Actions CI/CD with multi-platform testing

## Development Notes

- Extension includes Japanese comments and messages in the main code
- Uses React for webview components (v18.2.0)
- Dual TreeDataProvider architecture for file tree and profile management
- Real repomix CLI integration with proper error handling
- Comprehensive test coverage including actual command execution
- VS Code engine compatibility: ^1.74.0 (works with Windsurf)