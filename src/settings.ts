import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { AISettingsTabComponent } from './components/aiSettingsTab.component'

@Injectable()
export class AISettingsTabProvider extends SettingsTabProvider {
    id = 'ai-assistant'
    icon = 'robot'
    title = 'AI Assistant'

    getComponentType (): any {
        return AISettingsTabComponent
    }
}
