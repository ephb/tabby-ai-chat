import { ConfigProvider, Platform } from 'tabby-core'

export type AIProvider = 'openrouter' | 'litellm'

export interface AIAssistantConfig {
    // Provider Settings
    provider: AIProvider

    // OpenRouter Settings
    openRouterApiKey: string
    openRouterModel: string

    // LiteLLM / Custom Endpoint Settings
    litellmEndpoint: string
    litellmApiKey: string
    litellmModel: string

    // Behavior
    commandExecution: 'insert' | 'execute' | 'ask'
    defaultContextLines: number
    autoAttachOnOpen: boolean

    // UI
    panelWidthPercent: number
    showTimestamps: boolean

    // Advanced
    maxTokens: number
    temperature: number
    systemPrompt: string
}

export class AIAssistantConfigProvider extends ConfigProvider {
    defaults = {
        aiAssistant: {
            // Provider Settings
            provider: 'openrouter',

            // OpenRouter Settings
            openRouterApiKey: '',
            openRouterModel: 'openai/gpt-4o-mini',

            // LiteLLM / Custom Endpoint Settings
            litellmEndpoint: 'http://localhost:4000/v1',
            litellmApiKey: '',
            litellmModel: '',

            // Behavior
            commandExecution: 'insert',
            defaultContextLines: 50,
            autoAttachOnOpen: false,

            // UI
            panelWidthPercent: 40,
            showTimestamps: false,

            // Advanced
            maxTokens: 2048,
            temperature: 0.7,
            systemPrompt: `You are a helpful terminal assistant integrated into the Tabby terminal emulator.

When the user asks for help with terminal commands:
1. Provide clear, concise explanations
2. Wrap executable commands in \`\`\`bash code blocks
3. Explain what each command does
4. Warn about potentially dangerous operations

You have access to the user's terminal context when they attach it. Use this context to provide relevant, specific help.

Be concise and focused on solving terminal-related problems efficiently.`,
        },
        hotkeys: {
            'toggle-ai-panel': ['Ctrl-Shift-A'],
        },
    }

    platformDefaults = {
        [Platform.macOS]: {
            hotkeys: {
                'toggle-ai-panel': ['Cmd-Shift-A'],
            },
        },
    }
}
