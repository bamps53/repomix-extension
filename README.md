# Repomix Controller

Repomix Controller is a VSCode extension for the repomix CLI tool. It provides a visual interface for managing file selection states, saving/loading selection states with profiles, and executing repomix commands on selected files.

## Key Features

### File Tree View
- Display workspace files in a tree format
- File selection interface with checkboxes
- Support for recursive directory selection
- Visual display with custom icons

### Profile Management
- Save selected file states as profiles
- Load saved profiles
- Delete and rename profile functionality
- Dedicated profile management view with list display
- Profile operations via right-click context menu

### Repomix Execution
- Execute repomix on the selected file list
- Uses actual npx repomix command execution
- Automatic display of generated repomix-output.xml file
- Execution time measurement and result display

## Requirements

- Visual Studio Code 1.74.0 or higher
- Node.js 16.x or higher
- repomix CLI tool (install with `npm install -g repomix`)

## Usage

### Installation and Initial Setup
1. After installing the extension, install the repomix CLI tool:
   ```bash
   npm install -g repomix
   ```
2. Click the Repomix icon in the VSCode activity bar
3. Two views will be displayed: File Tree and Profiles

### File Selection
1. The **File Tree** view displays files in your workspace
2. Click files or folders to select them with checkboxes
3. Selecting a folder recursively selects all files within it
4. Selection states are visually indicated with icons

### Profile Management
1. After selecting files, click the "Save Profile" button (+) at the top of the File Tree view
2. Enter a profile name and save
3. Saved profiles are displayed in the **Profiles** view
4. Profile operations:
   - **Load**: Click the profile or right-click → "Load Profile"
   - **Rename**: Right-click → "Rename Profile"
   - **Delete**: Right-click → "Delete Profile"

### Running Repomix
1. After selecting files, click the run button (▶) at the top of the File Tree view
2. Or, select "Execute Repomix" from the Command Palette (`Ctrl+Shift+P`)
3. Repomix will be executed on the selected files
4. The generated `repomix-output.xml` file will open automatically
5. Execution time and processing results are displayed in the status bar

## Available Commands

The following commands are available in the extension:

- `repomix-extension.refresh` - Refresh the file tree
- `repomix-extension.executeRepomix` - Execute Repomix with selected files
- `repomix-extension.saveProfile` - Save current selection state as a profile
- `repomix-extension.loadProfile` - Load a profile
- `repomix-extension.renameProfile` - Rename a profile
- `repomix-extension.deleteProfile` - Delete a profile
- `repomix-extension.toggleChecked` - Toggle file/folder selection state

## Known Issues

- Potential performance degradation with very large directory structures
- Error handling when repomix CLI tool is not installed

## Release Notes

### 0.0.1

Initial release
- File tree view with checkbox selection
- Profile management (save/load/delete/rename)
- Integration with actual repomix CLI
- Dedicated profile management view
- Comprehensive test suite (49 tests)
- GitHub Actions CI/CD pipeline

---

## Development Information

### Technology Stack
- TypeScript 5.8+
- VSCode Extension API 1.74+
- Webpack (bundling)
- Mocha, Chai, Sinon (testing)

### Architecture
- `extension.ts`: Extension entry point and command registration
- `fileTree.ts`: File system tree view provider
- `profileManager.ts`: Profile save and management functionality
- `repomixRunner.ts`: Repomix command execution and XML file processing

### Test Configuration
- `npm run test:unit` - Unit tests (49 tests)
- `npm test` - VS Code integration tests
- Tests include actual repomix execution
- Automated test execution in CI environment

## More Information

* [VSCode Extension Development Documentation](https://code.visualstudio.com/api)
* [GitHub Repository](https://github.com/bamps53/repomix-extension)

## License

MIT