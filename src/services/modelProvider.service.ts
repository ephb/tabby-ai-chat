import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { AIProvider } from '../config'

export interface ModelInfo {
    id: string
    name: string
    description?: string
    contextLength?: number
    pricing?: {
        prompt: number
        completion: number
    }
}

@Injectable({ providedIn: 'root' })
export class ModelProviderService {
    private modelsCache: Map<string, { models: ModelInfo[]; timestamp: number }> = new Map()
    private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    constructor (private config: ConfigService) {}

    /**
     * Get the current provider setting
     */
    get currentProvider (): AIProvider {
        return this.config.store.aiAssistant?.provider ?? 'openrouter'
    }

    /**
     * Get the current model based on provider
     */
    get currentModel (): string {
        const cfg = this.config.store.aiAssistant
        if (this.currentProvider === 'openrouter') {
            return cfg?.openRouterModel ?? 'openai/gpt-4o-mini'
        }
        return cfg?.litellmModel ?? ''
    }

    /**
     * Set the current model for the active provider
     */
    setModel (modelId: string): void {
        if (this.currentProvider === 'openrouter') {
            this.config.store.aiAssistant.openRouterModel = modelId
        } else {
            this.config.store.aiAssistant.litellmModel = modelId
        }
        this.config.save()
    }

    /**
     * Get API endpoint based on provider
     */
    getEndpoint (): string {
        const cfg = this.config.store.aiAssistant
        if (this.currentProvider === 'openrouter') {
            return 'https://openrouter.ai/api/v1'
        }
        return cfg?.litellmEndpoint?.replace(/\/+$/, '') ?? 'http://localhost:4000/v1'
    }

    /**
     * Get API key based on provider
     */
    getApiKey (): string {
        const cfg = this.config.store.aiAssistant
        if (this.currentProvider === 'openrouter') {
            return cfg?.openRouterApiKey ?? ''
        }
        return cfg?.litellmApiKey ?? ''
    }

    /**
     * Fetch available models from the current provider
     */
    async fetchModels (forceRefresh = false): Promise<ModelInfo[]> {
        const cacheKey = `${this.currentProvider}-${this.getEndpoint()}`

        // Check cache
        if (!forceRefresh) {
            const cached = this.modelsCache.get(cacheKey)
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.models
            }
        }

        try {
            const models = this.currentProvider === 'openrouter'
                ? await this.fetchOpenRouterModels()
                : await this.fetchLiteLLMModels()

            // Update cache
            this.modelsCache.set(cacheKey, { models, timestamp: Date.now() })
            return models
        } catch (error) {
            console.error('Failed to fetch models:', error)
            // Return cached if available, otherwise empty
            const cached = this.modelsCache.get(cacheKey)
            return cached?.models ?? []
        }
    }

    /**
     * Fetch models from OpenRouter API
     */
    private async fetchOpenRouterModels (): Promise<ModelInfo[]> {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                Authorization: `Bearer ${this.getApiKey()}`,
            },
        })

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`)
        }

        const data = await response.json()

        return (data.data || []).map((model: any) => ({
            id: model.id,
            name: model.name || model.id,
            description: model.description,
            contextLength: model.context_length,
            pricing: model.pricing ? {
                prompt: parseFloat(model.pricing.prompt) * 1000000,
                completion: parseFloat(model.pricing.completion) * 1000000,
            } : undefined,
        })).sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
    }

    /**
     * Fetch models from LiteLLM/OpenAI-compatible endpoint
     */
    private async fetchLiteLLMModels (): Promise<ModelInfo[]> {
        const endpoint = this.getEndpoint()
        const apiKey = this.getApiKey()

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`
        }

        const response = await fetch(`${endpoint}/models`, { headers })

        if (!response.ok) {
            throw new Error(`LiteLLM API error: ${response.status}`)
        }

        const data = await response.json()

        return (data.data || []).map((model: any) => ({
            id: model.id,
            name: model.id,
            description: model.description,
            contextLength: model.context_length,
        })).sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
    }

    /**
     * Get request headers for API calls
     */
    getRequestHeaders (): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }

        const apiKey = this.getApiKey()
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`
        }

        if (this.currentProvider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/Eugeny/tabby'
            headers['X-Title'] = 'Tabby Terminal AI Assistant'
        }

        return headers
    }
}
