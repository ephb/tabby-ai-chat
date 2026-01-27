# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of tabby-ai-assistant as a standalone plugin
- AI chat panel integrated into terminal tabs
- Support for OpenRouter API with model selection
- Support for LiteLLM / custom OpenAI-compatible endpoints
- Terminal context extraction (configurable line count)
- Markdown rendering in chat responses with syntax highlighting
- Code block copy functionality
- Command execution (insert/execute/ask modes)
- Configurable panel width (20-60%)
- Auto-attach terminal context option
- Customizable system prompt
- Temperature and max tokens settings
- Keyboard shortcuts for panel toggle and focus

### Configuration Options
- `provider`: Choose between OpenRouter or LiteLLM
- `openRouterApiKey`: API key for OpenRouter
- `openRouterModel`: Model selection for OpenRouter
- `litellmEndpoint`: Custom endpoint URL
- `litellmApiKey`: Optional API key for custom endpoint
- `litellmModel`: Model name for custom endpoint
- `maxTokens`: Maximum response tokens (256-128000)
- `temperature`: Response randomness (0-1)
- `defaultContextLines`: Terminal lines to include (10-500)
- `commandExecution`: insert | execute | ask
- `panelWidthPercent`: Panel width percentage
- `autoAttachOnOpen`: Auto-attach context when opening panel
- `systemPrompt`: Custom system prompt
