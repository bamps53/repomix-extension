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
  private _cachedHtml?: string;

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {
    this._extensionUri = context.extensionUri;
    // Pre-generate HTML to reduce initial rendering time
    this._cachedHtml = this._generateHtml();
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

    // webview.options is read-only, so no need to reassign

    // Use pre-cached HTML for instant display
    webviewView.webview.html = this._cachedHtml || this._getHtmlForWebview(webviewView.webview);

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

  private _generateHtml(): string {
    const nonce = getNonce();
    return this._buildHtmlContent(nonce);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();
    return this._buildHtmlContent(nonce);
  }

  private _buildHtmlContent(nonce: string): string {
    // The new HTML with improved CSS for minimizing vertical space
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Search Files</title>
        <style>
          /* Define height variables for easy adjustment */
          :root {
            --input-height: 24px;
          }

          /* Make html, body cover the entire webview area and match the sidebar background */
          html, body {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: var(--vscode-sideBar-background);
          }

          /* Position the content at the top of the container */
          body {
            display: flex;
            align-items: flex-start; /* Align content to the top */
            box-sizing: border-box;
          }
          
          .search-container {
            display: flex;
            align-items: center;
            width: 100%;
            height: var(--input-height);
            padding: 0 8px; /* Horizontal padding */
            box-sizing: border-box;
          }

          .search-icon {
            width: 16px;
            height: 16px;
            margin-right: 4px;
            color: var(--vscode-icon-foreground);
            flex-shrink: 0;
          }

          .search-input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 2px 4px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            outline: none;
            border-radius: 2px;
            height: 100%;
            box-sizing: border-box;
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
            color: var(--vscode-icon-foreground);
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          .clear-button:hover {
            opacity: 1;
          }
          .clear-button.hidden {
            visibility: hidden; /* Use visibility to prevent layout shifts */
            opacity: 0;
          }
          .clear-icon {
            width: 14px;
            height: 14px;
          }
        </style>
      </head>
      <body>
        <div class="search-container">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            placeholder="Filter files..."
            id="searchInput"
          />
          <button class="clear-button hidden" id="clearButton" title="Clear search">
            <svg class="clear-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M7 3.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 7 3.5ZM6.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5Zm2 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5Zm2 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5Zm-5-3.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Zm0 6.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/>
                <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h2a.5.5 0 0 1 .5.5v1.857a.25.25 0 0 0 .25.25h1.5a.25.25 0 0 0 .25-.25V5.5a.5.5 0 0 0-1 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h1.5a.25.25 0 0 0 .25-.25V3.5a.5.5 0 0 0-1 0V4H2.5a.5.5 0 0 1-.5-.5v-1A.5.5 0 0 1 2.5 2H4V1.5a.5.5 0 0 0-.5-.5H2Z"/>
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
            clearButton.classList.toggle('hidden', !value);

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

          // Focus immediately (no need to wait for load event)
          searchInput.focus();
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