import * as vscode from 'vscode';

/**
 * Search WebView Provider
 * Provides a real input form for file search
 */
export class SearchWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repomixSearchWebview';

  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private onSearchChangeCallback?: (query: string) => void;

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {
    this._extensionUri = context.extensionUri;
  }

  /**
   * Set callback for search query changes
   */
  setOnSearchChange(callback: (query: string) => void): void {
    this.onSearchChangeCallback = callback;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'search':
          if (this.onSearchChangeCallback) {
            this.onSearchChangeCallback(message.query);
          }
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Search Files</title>
        <style>
          html {
            height: 32px;
            overflow: hidden;
          }
          body {
            padding: 0;
            margin: 0;
            background: transparent;
            height: 32px;
            overflow: hidden;
            display: flex;
            align-items: center;
          }
          .search-container {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            box-sizing: border-box;
            height: 100%;
            width: 100%;
          }
          .search-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
            opacity: 0.6;
            flex-shrink: 0;
          }
          .search-input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 3px 8px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            outline: none;
            border-radius: 2px;
          }
          .search-input:focus {
            border-color: var(--vscode-focusBorder);
          }
          .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
          }
          .clear-button {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 2px;
            margin-left: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          .clear-button:hover {
            opacity: 1;
          }
          .clear-button.hidden {
            display: none;
          }
          .clear-icon {
            width: 16px;
            height: 16px;
          }
        </style>
      </head>
      <body style="height: 32px; max-height: 32px;">
        <div class="search-container">
          <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.5 1a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM7 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
            <path d="M5.077 9.457a5.465 5.465 0 0 0 1.466 1.466l-5.21 5.21a1 1 0 1 1-1.415-1.414l5.159-5.262z"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            placeholder="Filter files (e.g., *.ts, test*, config.*)"
            id="searchInput"
          />
          <button class="clear-button hidden" id="clearButton" title="Clear search">
            <svg class="clear-icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM3 8a5 5 0 1 1 10 0A5 5 0 0 1 3 8z"/>
              <path d="M10.5 5.5L8 8l2.5 2.5-1 1L7 9 4.5 11.5l-1-1L6 8 3.5 5.5l1-1L7 7l2.5-2.5 1 1z"/>
            </svg>
          </button>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const searchInput = document.getElementById('searchInput');
          const clearButton = document.getElementById('clearButton');
          let debounceTimer;

          // Handle input changes with debouncing
          searchInput.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Show/hide clear button
            if (value) {
              clearButton.classList.remove('hidden');
            } else {
              clearButton.classList.add('hidden');
            }

            // Debounce search
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              vscode.postMessage({
                command: 'search',
                query: value
              });
            }, 150);
          });

          // Handle clear button
          clearButton.addEventListener('click', () => {
            searchInput.value = '';
            clearButton.classList.add('hidden');
            vscode.postMessage({
              command: 'search',
              query: ''
            });
            searchInput.focus();
          });

          // Focus on load
          searchInput.focus();
          
          // Notify VS Code about the preferred size
          // This helps reduce unnecessary space
          if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
              const height = document.body.offsetHeight;
              vscode.postMessage({
                command: 'resize',
                height: height
              });
            });
            resizeObserver.observe(document.body);
          }
        </script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}