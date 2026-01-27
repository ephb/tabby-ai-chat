import { Component, HostBinding, OnInit } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { ModelProviderService, ModelInfo } from '../services/modelProvider.service'
import { AIProvider } from '../config'

@Component({
    templateUrl: './aiSettingsTab.component.pug',
    styleUrls: ['./aiSettingsTab.component.scss'],
})
export class AISettingsTabComponent implements OnInit {
    @HostBinding('class.content-box') true

    // Model lists
    openRouterModels: ModelInfo[] = []
    litellmModels: ModelInfo[] = []
    isLoadingOpenRouterModels = false
    isLoadingLitellmModels = false

    // Search filters
    openRouterSearchTerm = ''
    litellmSearchTerm = ''

    constructor (
        public config: ConfigService,
        private modelProvider: ModelProviderService,
    ) {}

    ngOnInit (): void {
        // Load models for the current provider
        if (this.currentProvider === 'openrouter') {
            this.loadOpenRouterModels()
        } else {
            this.loadLitellmModels()
        }
    }

    get currentProvider (): AIProvider {
        return this.config.store.aiAssistant?.provider ?? 'openrouter'
    }

    setProvider (provider: AIProvider): void {
        this.config.store.aiAssistant.provider = provider
        this.config.save()

        // Load models for the new provider
        if (provider === 'openrouter' && this.openRouterModels.length === 0) {
            this.loadOpenRouterModels()
        } else if (provider === 'litellm' && this.litellmModels.length === 0) {
            this.loadLitellmModels()
        }
    }

    async loadOpenRouterModels (): Promise<void> {
        this.isLoadingOpenRouterModels = true
        try {
            // Temporarily switch to openrouter to fetch models
            const originalProvider = this.config.store.aiAssistant.provider
            this.config.store.aiAssistant.provider = 'openrouter'
            this.openRouterModels = await this.modelProvider.fetchModels(true)
            this.config.store.aiAssistant.provider = originalProvider
        } catch (error) {
            console.error('Failed to load OpenRouter models:', error)
        } finally {
            this.isLoadingOpenRouterModels = false
        }
    }

    async loadLitellmModels (): Promise<void> {
        this.isLoadingLitellmModels = true
        try {
            // Temporarily switch to litellm to fetch models
            const originalProvider = this.config.store.aiAssistant.provider
            this.config.store.aiAssistant.provider = 'litellm'
            this.litellmModels = await this.modelProvider.fetchModels(true)
            this.config.store.aiAssistant.provider = originalProvider
        } catch (error) {
            console.error('Failed to load LiteLLM models:', error)
        } finally {
            this.isLoadingLitellmModels = false
        }
    }

    get filteredOpenRouterModels (): ModelInfo[] {
        if (!this.openRouterSearchTerm) {
            return this.openRouterModels.slice(0, 100)
        }
        const term = this.openRouterSearchTerm.toLowerCase()
        return this.openRouterModels.filter(m =>
            m.id.toLowerCase().includes(term) ||
            m.name.toLowerCase().includes(term),
        ).slice(0, 100)
    }

    get filteredLitellmModels (): ModelInfo[] {
        if (!this.litellmSearchTerm) {
            return this.litellmModels.slice(0, 100)
        }
        const term = this.litellmSearchTerm.toLowerCase()
        return this.litellmModels.filter(m =>
            m.id.toLowerCase().includes(term) ||
            m.name.toLowerCase().includes(term),
        ).slice(0, 100)
    }

    selectOpenRouterModel (model: ModelInfo): void {
        this.config.store.aiAssistant.openRouterModel = model.id
        this.config.save()
    }

    selectLitellmModel (model: ModelInfo): void {
        this.config.store.aiAssistant.litellmModel = model.id
        this.config.save()
    }

    testConnection (): void {
        // TODO: Implement connection test
        console.log('Testing connection...')
    }
}
