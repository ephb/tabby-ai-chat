import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core'
import { Subscription } from 'rxjs'
import { ConfigService } from 'tabby-core'
import { Frontend } from 'tabby-terminal'
import { TerminalContextService } from '../services/terminalContext.service'
import { ModelProviderService, ModelInfo } from '../services/modelProvider.service'

type ContextMode = 'none' | 'visible' | 'lastN' | 'lastCommand' | 'selection'

interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    isStreaming?: boolean
    attachedContext?: string
}

@Component({
    selector: 'ai-panel',
    templateUrl: './aiPanel.component.pug',
    styleUrls: ['./aiPanel.component.scss'],
})
export class AIPanelComponent implements OnInit, OnDestroy {
    @Input() frontend: Frontend | undefined
    @Output() closed = new EventEmitter<void>()
    @Output() insertCommand = new EventEmitter<string>()
    @Output() executeCommand = new EventEmitter<string>()

    @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>
    @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>

    // Each panel has its own messages - not shared!
    messages: ChatMessage[] = []
    inputText = ''
    isLoading = false
    currentStreamingContent = ''
    currentStreamingId = ''

    // Context options
    contextMode: ContextMode = 'none'
    contextLines = 50
    attachedContext = ''
    showContextPreview = false

    // Model picker
    availableModels: ModelInfo[] = []
    isLoadingModels = false
    modelSearchTerm = ''

    private subscriptions: Subscription[] = []
    private abortController: AbortController | null = null

    constructor (
        private contextService: TerminalContextService,
        private config: ConfigService,
        private cdr: ChangeDetectorRef,
        public modelProvider: ModelProviderService,
    ) {}

    ngOnInit (): void {
        // Load context settings
        this.contextLines = this.config.store.aiAssistant?.defaultContextLines ?? 50

        // Auto-attach context if configured
        if (this.config.store.aiAssistant?.autoAttachOnOpen) {
            this.contextMode = 'lastN'
            this.updateAttachedContext()
        }

        // Load available models
        this.loadModels()
    }

    async loadModels (forceRefresh = false): Promise<void> {
        this.isLoadingModels = true
        this.cdr.detectChanges()

        try {
            this.availableModels = await this.modelProvider.fetchModels(forceRefresh)
        } catch (error) {
            console.error('Failed to load models:', error)
        } finally {
            this.isLoadingModels = false
            this.cdr.detectChanges()
        }
    }

    selectModel (model: ModelInfo): void {
        this.modelProvider.setModel(model.id)
        this.cdr.detectChanges()
    }

    get filteredModels (): ModelInfo[] {
        if (!this.modelSearchTerm) {
            return this.availableModels.slice(0, 50) // Limit initial display
        }
        const term = this.modelSearchTerm.toLowerCase()
        return this.availableModels.filter(m =>
            m.id.toLowerCase().includes(term) ||
            m.name.toLowerCase().includes(term),
        ).slice(0, 50)
    }

    get currentModelDisplay (): string {
        const modelId = this.modelProvider.currentModel
        const model = this.availableModels.find(m => m.id === modelId)
        if (model) {
            return model.name
        }
        // Truncate long model IDs for display
        if (modelId.length > 25) {
            return modelId.slice(0, 22) + '...'
        }
        return modelId || 'Select model'
    }

    ngOnDestroy (): void {
        this.subscriptions.forEach(s => s.unsubscribe())
        this.cancelRequest()
    }

    close (): void {
        this.closed.emit()
    }

    async sendMessage (): Promise<void> {
        const text = this.inputText.trim()
        if (!text || this.isLoading) { return }

        this.inputText = ''
        this.isLoading = true
        this.cdr.detectChanges()

        // Update context before sending
        this.updateAttachedContext()

        // Create user message
        const userMsg: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: text,
            timestamp: new Date(),
            attachedContext: this.attachedContext || undefined,
        }
        this.messages.push(userMsg)

        // Create placeholder for assistant response
        const assistantMsg: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        }
        this.messages.push(assistantMsg)
        this.currentStreamingId = assistantMsg.id
        this.currentStreamingContent = ''
        this.cdr.detectChanges()
        this.scrollToBottom()

        try {
            this.abortController = new AbortController()

            await this.makeStreamingRequest(text, assistantMsg)

        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('AI request failed:', error)
                assistantMsg.content = `Error: ${(error as Error).message}`
            }
            assistantMsg.isStreaming = false
            this.isLoading = false
        }

        this.abortController = null
        this.cdr.detectChanges()
        this.scrollToBottom()

        // Clear context after sending
        if (this.contextMode !== 'none') {
            this.attachedContext = ''
            this.showContextPreview = false
        }
    }

    private async makeStreamingRequest (userMessage: string, assistantMsg: ChatMessage): Promise<void> {
        const aiConfig = this.config.store.aiAssistant
        const apiKey = this.modelProvider.getApiKey()

        // Only require API key for OpenRouter - LiteLLM may not need one
        if (!apiKey && this.modelProvider.currentProvider === 'openrouter') {
            throw new Error('API key not configured. Please set your OpenRouter API key in Settings > AI Assistant.')
        }

        const endpoint = this.modelProvider.getEndpoint() + '/chat/completions'

        // Build messages for API
        const apiMessages: { role: string; content: string }[] = []

        // System prompt
        let systemContent = aiConfig.systemPrompt || 'You are a helpful terminal assistant.'
        if (this.attachedContext) {
            systemContent += `\n\n## Current Terminal Context\n\`\`\`\n${this.attachedContext}\n\`\`\``
        }
        apiMessages.push({ role: 'system', content: systemContent })

        // Add conversation history (excluding current streaming message)
        for (const msg of this.messages) {
            if (msg.isStreaming) { continue }
            if (msg.role === 'user' || msg.role === 'assistant') {
                apiMessages.push({ role: msg.role, content: msg.content })
            }
        }

        const body = {
            model: this.modelProvider.currentModel,
            messages: apiMessages,
            max_tokens: aiConfig.maxTokens || 2048,
            temperature: aiConfig.temperature || 0.7,
            stream: true,
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this.modelProvider.getRequestHeaders(),
            body: JSON.stringify(body),
            signal: this.abortController?.signal,
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

        // Process stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) { break }

                buffer += decoder.decode(value, { stream: true })

                // Process complete SSE events
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith('data: ')) { continue }

                    const data = trimmed.slice(6)
                    if (data === '[DONE]') { continue }

                    try {
                        const parsed = JSON.parse(data)
                        const delta = parsed.choices?.[0]?.delta?.content
                        if (delta) {
                            this.currentStreamingContent += delta
                            assistantMsg.content = this.currentStreamingContent
                            this.cdr.detectChanges()
                            this.scrollToBottom()
                        }
                    } catch {
                        // Skip malformed JSON chunks
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }

        // Finalize message
        assistantMsg.content = this.currentStreamingContent
        assistantMsg.isStreaming = false
        this.currentStreamingId = ''
        this.currentStreamingContent = ''
        this.isLoading = false
        this.cdr.detectChanges()
    }

    cancelRequest (): void {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
        this.isLoading = false
        this.currentStreamingId = ''
        this.currentStreamingContent = ''

        // Mark any streaming message as complete
        for (const msg of this.messages) {
            if (msg.isStreaming) {
                msg.isStreaming = false
                if (!msg.content) {
                    msg.content = '(cancelled)'
                }
            }
        }
        this.cdr.detectChanges()
    }

    clearChat (): void {
        this.messages = []
        this.currentStreamingContent = ''
        this.currentStreamingId = ''
        this.isLoading = false
        this.cdr.detectChanges()
    }

    onKeyDown (event: KeyboardEvent): void {
        // Prevent terminal from capturing keystrokes
        event.stopPropagation()

        // Submit on Enter (without Shift)
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            this.sendMessage()
        }

        // Cancel on Escape
        if (event.key === 'Escape') {
            if (this.isLoading) {
                this.cancelRequest()
            } else {
                this.close()
            }
        }
    }

    // Context management
    setContextMode (mode: ContextMode): void {
        this.contextMode = mode
        if (mode !== 'none') {
            this.updateAttachedContext()
            this.showContextPreview = true
        } else {
            this.attachedContext = ''
            this.showContextPreview = false
        }
    }

    updateAttachedContext (): void {
        if (!this.frontend) {
            this.attachedContext = ''
            return
        }

        let context: { content: string } | null = null

        switch (this.contextMode) {
            case 'visible':
                context = this.contextService.getVisibleContent(this.frontend)
                break
            case 'lastN':
                context = this.contextService.getLastNLines(this.frontend, this.contextLines)
                break
            case 'lastCommand':
                context = this.contextService.getLastCommandContext(this.frontend)
                break
            case 'selection':
                const selection = this.contextService.getSelection(this.frontend)
                if (selection) {
                    this.attachedContext = selection
                    return
                }
                break
            case 'none':
            default:
                this.attachedContext = ''
                return
        }

        this.attachedContext = context?.content ?? ''
    }

    refreshContext (): void {
        this.updateAttachedContext()
    }

    // Command handling
    handleInsertCommand (command: string): void {
        this.insertCommand.emit(command)
    }

    handleExecuteCommand (command: string): void {
        const execMode = this.config.store.aiAssistant?.commandExecution ?? 'insert'

        switch (execMode) {
            case 'execute':
                this.executeCommand.emit(command)
                break
            case 'ask':
                // Could show a confirmation dialog here
                // For now, just insert
                this.insertCommand.emit(command)
                break
            case 'insert':
            default:
                this.insertCommand.emit(command)
                break
        }
    }

    extractCommands (content: string): string[] {
        const commands: string[] = []
        const codeBlockRegex = /```(?:bash|shell|sh|zsh|cmd|powershell|ps1)?\n([\s\S]*?)```/g

        let match: RegExpExecArray | null = null
        while ((match = codeBlockRegex.exec(content)) !== null) {
            const code = match[1].trim()
            if (code) {
                const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
                commands.push(...lines)
            }
        }

        return commands
    }

    setInputAndFocus (text: string): void {
        this.inputText = text
        this.focusInput()
    }

    onInputFocus (): void {
        // Ensure the input maintains focus
    }

    focusInput (): void {
        setTimeout(() => {
            this.messageInput.nativeElement.focus()
        }, 0)
    }

    private scrollToBottom (): void {
        setTimeout(() => {
            const el = this.messagesContainer.nativeElement
            el.scrollTop = el.scrollHeight
        }, 0)
    }

    private generateId (): string {
        return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    }

    get contextModeLabel (): string {
        const labels: Record<ContextMode, string> = {
            none: 'No context',
            visible: 'Visible content',
            lastN: `Last ${this.contextLines} lines`,
            lastCommand: 'Last command',
            selection: 'Selection',
        }
        return labels[this.contextMode]
    }
}
