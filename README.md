# tabby-ai-assistant

AI Assistant plugin for [Tabby](https://tabby.sh) - Chat with AI while accessing terminal context.

## Features

- **AI Chat Panel** - Integrated chat interface in terminal tabs
- **Terminal Context** - Automatically capture and send terminal output as context
- **Multiple Providers** - Support for OpenRouter and LiteLLM/custom endpoints
- **Model Selection** - Browse and search available models
- **Code Actions** - Copy code blocks or execute commands directly in terminal
- **Customizable** - Adjust panel width, temperature, token limits, and more

## Installation

### From Tabby Plugin Manager

1. Open Tabby
2. Go to **Settings** > **Plugins**
3. Search for `tabby-ai-assistant`
4. Click **Install**

### Manual Installation

```bash
# Install globally
npm install -g tabby-ai-assistant

# Or install to Tabby's plugin directory
cd ~/.config/tabby/plugins  # Linux/macOS
cd %APPDATA%\tabby\plugins  # Windows
npm install tabby-ai-assistant
```

## Configuration

After installation, go to **Settings** > **AI Assistant** to configure:

### Provider Setup

**OpenRouter** (recommended for cloud):
1. Get an API key from [openrouter.ai/keys](https://openrouter.ai/keys)
2. Select OpenRouter as provider
3. Enter your API key
4. Choose a model from the list

**LiteLLM / Custom Endpoint** (for self-hosted):
1. Select LiteLLM as provider
2. Enter your endpoint URL (e.g., `http://localhost:4000/v1`)
3. Optionally add an API key
4. Enter or select your model name

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Provider | OpenRouter or LiteLLM | OpenRouter |
| Max Tokens | Maximum response length | 4096 |
| Temperature | Response randomness (0-1) | 0.7 |
| Context Lines | Terminal lines to capture | 100 |
| Command Execution | insert / execute / ask | insert |
| Panel Width | Percentage of terminal width | 35% |
| Auto-attach Context | Capture context when opening | true |

## Usage

### Keyboard Shortcuts

| Action | Default Shortcut |
|--------|------------------|
| Toggle AI Panel | `Ctrl+Shift+A` |
| Focus AI Input | `Ctrl+Shift+I` |

### Chat Interface

1. Open the AI panel with `Ctrl+Shift+A`
2. Type your question or request
3. Click the attachment icon to include terminal context
4. Press Enter or click Send

### Code Blocks

AI responses with code blocks include:
- **Copy** button - Copy code to clipboard
- **Execute** button - Run command in terminal (behavior based on settings)

## Development

```bash
# Clone the repository
git clone https://github.com/ephb/tabby-ai-assistant.git
cd tabby-ai-assistant

# Install dependencies
npm install

# Build
npm run build

# Watch mode for development
npm run watch

# Lint
npm run lint
```

### Testing Locally

Set the `TABBY_PLUGINS` environment variable to load the plugin:

```bash
# Linux/macOS
TABBY_PLUGINS=/path/to/tabby-ai-assistant tabby

# Windows (PowerShell)
$env:TABBY_PLUGINS="C:\path\to\tabby-ai-assistant"; tabby
```

## License

MIT - See [LICENSE](LICENSE) for details.

## Author

Philipp Bontemps <philipp@vrtxlabs.com>

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
