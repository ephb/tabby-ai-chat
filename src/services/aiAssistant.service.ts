import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { Subject, Observable } from 'rxjs'

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    isStreaming?: boolean
    attachedContext?: string
}

export interface StreamingChunk {
    messageId: string
    content: string
    done: boolean
}

export interface AIRequestOptions {
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    signal?: AbortSignal
}

/**
 * Service for communicating with AI/LLM APIs.
 * Supports OpenRouter and OpenAI-compatible endpoints with streaming.
 */
@Injectable({ providedIn: 'root' })
export class AIAssistantService {
    private streamSubject = new Subject<StreamingChunk>()
    private conversationHistory: ChatMessage[] = []

    constructor (private config: ConfigService) {}

    get stream$ (): Observable<StreamingChunk> {
        return this.streamSubject.asObservable()
    }

    get history (): ChatMessage[] {
        return [...this.conversationHistory]
    }

    clearHistory (): void {
        this.conversationHistory = []
    }

    /**
     * Send a message and receive a streaming response
     */
    async sendMessage (
        userMessage: string,
        attachedContext?: string,
        options?: AIRequestOptions,
    ): Promise<ChatMessage> {
        const aiConfig = this.config.store.aiAssistant

        // Create user message
        const userMsg: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: userMessage,
            timestamp: new Date(),
            attachedContext,
        }
        this.conversationHistory.push(userMsg)

        // Create placeholder for assistant response
        const assistantMsg: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        }
        this.conversationHistory.push(assistantMsg)

        try {
            // Build messages array for API
            const messages = this.buildMessagesPayload(
                options?.systemPrompt ?? aiConfig.systemPrompt,
                attachedContext,
            )

            // Make streaming request
            const response = await this.makeStreamingRequest(
                messages,
                assistantMsg.id,
                {
                    maxTokens: options?.maxTokens ?? aiConfig.maxTokens,
                    temperature: options?.temperature ?? aiConfig.temperature,
                    signal: options?.signal,
                },
            )

            assistantMsg.content = response
            assistantMsg.isStreaming = false

            return assistantMsg
        } catch (error) {
            assistantMsg.isStreaming = false
            assistantMsg.content = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`

            this.streamSubject.next({
                messageId: assistantMsg.id,
                content: '',
                done: true,
            })

            throw error
        }
    }

    /**
     * Build the messages payload for the API
     */
    private buildMessagesPayload (
        systemPrompt: string,
        attachedContext?: string,
    ): { role: string; content: string }[] {
        const messages: { role: string; content: string }[] = []

        // System message with optional context
        let systemContent = systemPrompt
        if (attachedContext) {
            systemContent += `\n\n## Current Terminal Context\n\`\`\`\n${attachedContext}\n\`\`\``
        }
        messages.push({ role: 'system', content: systemContent })

        // Add conversation history (excluding system messages and the current streaming message)
        for (const msg of this.conversationHistory) {
            if (msg.role === 'system') { continue }
            if (msg.isStreaming) { continue }

            let { content } = msg
            if (msg.role === 'user' && msg.attachedContext) {
                content = `[Terminal context attached]\n\n${content}`
            }
            messages.push({ role: msg.role, content })
        }

        return messages
    }

    /**
     * Make a streaming request to the API
     */
    private async makeStreamingRequest (
        messages: { role: string; content: string }[],
        messageId: string,
        options: {
            maxTokens: number
            temperature: number
            signal?: AbortSignal
        },
    ): Promise<string> {
        const aiConfig = this.config.store.aiAssistant

        if (!aiConfig.apiKey) {
            throw new Error('API key not configured. Please set your API key in Settings > AI Assistant.')
        }

        const endpoint = aiConfig.apiEndpoint.replace(/\/+$/, '') + '/chat/completions'

        const body = {
            model: aiConfig.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            stream: true,
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${aiConfig.apiKey}`,
                'HTTP-Referer': 'https://github.com/Eugeny/tabby',
                'X-Title': 'Tabby Terminal AI Assistant',
            },
            body: JSON.stringify(body),
            signal: options.signal,
        })

        if (!response.ok) {
            const errorText = await response.text()
            let errorMessage = `API request failed: ${response.status}`
            try {
                const errorJson = JSON.parse(errorText)
                errorMessage = errorJson.error?.message || errorJson.message || errorMessage
            } catch {
                if (errorText) {
                    errorMessage = errorText.slice(0, 200)
                }
            }
            throw new Error(errorMessage)
        }

        if (!response.body) {
            throw new Error('Response body is null')
        }

        return this.processStream(response.body, messageId)
    }

    /**
     * Process SSE stream from the API
     */
    private async processStream (
        body: ReadableStream<Uint8Array>,
        messageId: string,
    ): Promise<string> {
        const reader = body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) { break }

                buffer += decoder.decode(value, { stream: true })

                // Process complete SSE events
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? '' // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith('data: ')) { continue }

                    const data = trimmed.slice(6) // Remove 'data: ' prefix
                    if (data === '[DONE]') { continue }

                    try {
                        const parsed = JSON.parse(data)
                        const delta = parsed.choices?.[0]?.delta?.content
                        if (delta) {
                            fullContent += delta
                            this.streamSubject.next({
                                messageId,
                                content: delta,
                                done: false,
                            })
                        }
                    } catch {
                        // Skip malformed JSON chunks
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }

        this.streamSubject.next({
            messageId,
            content: '',
            done: true,
        })

        return fullContent
    }

    /**
     * Extract executable commands from a message content.
     * Looks for ```bash or ```shell code blocks.
     */
    extractCommands (content: string): string[] {
        const commands: string[] = []
        const codeBlockRegex = /```(?:bash|shell|sh|zsh|cmd|powershell|ps1)?\n([\s\S]*?)```/g

        let match: RegExpExecArray | null = null
        while ((match = codeBlockRegex.exec(content)) !== null) {
            const code = match[1].trim()
            if (code) {
                // Split by newlines for multi-line commands
                const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
                commands.push(...lines)
            }
        }

        return commands
    }

    /**
     * Check if the API is configured and reachable
     */
    async testConnection (): Promise<{ success: boolean; message: string }> {
        const aiConfig = this.config.store.aiAssistant

        if (!aiConfig.apiKey) {
            return { success: false, message: 'API key not configured' }
        }

        try {
            const endpoint = aiConfig.apiEndpoint.replace(/\/+$/, '') + '/models'
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${aiConfig.apiKey}`,
                },
            })

            if (response.ok) {
                return { success: true, message: 'Connection successful' }
            } else {
                return { success: false, message: `API returned ${response.status}` }
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
            }
        }
    }

    private generateId (): string {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }
}
