import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCoreModule, { ConfigProvider, HotkeyProvider } from 'tabby-core'
import TabbyTerminalModule, { TerminalDecorator } from 'tabby-terminal'
import { SettingsTabProvider } from 'tabby-settings'

// Config and Hotkeys
import { AIAssistantConfigProvider } from './config'
import { AIAssistantHotkeyProvider } from './hotkeys'

// Settings
import { AISettingsTabProvider } from './settings'

// Services
import { AIAssistantService } from './services/aiAssistant.service'
import { TerminalContextService } from './services/terminalContext.service'
import { ModelProviderService } from './services/modelProvider.service'

// Decorators
import { AIAssistantDecorator } from './decorators/aiAssistant.decorator'

// Components
import { AIPanelComponent } from './components/aiPanel.component'
import { AISettingsTabComponent } from './components/aiSettingsTab.component'

// Pipes
import { AIMarkdownPipe } from './pipes/aiMarkdown.pipe'

/** @hidden */
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
        TabbyCoreModule,
        TabbyTerminalModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: AIAssistantConfigProvider, multi: true },
        { provide: HotkeyProvider, useClass: AIAssistantHotkeyProvider, multi: true },
        { provide: TerminalDecorator, useClass: AIAssistantDecorator, multi: true },
        { provide: SettingsTabProvider, useClass: AISettingsTabProvider, multi: true },
        AIAssistantService,
        TerminalContextService,
        ModelProviderService,
    ],
    declarations: [
        AIPanelComponent,
        AISettingsTabComponent,
        AIMarkdownPipe,
    ],
    exports: [
        AIPanelComponent,
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class AIAssistantModule { }

// Public API exports
export { AIAssistantService, ChatMessage, StreamingChunk } from './services/aiAssistant.service'
export { TerminalContextService, TerminalContext } from './services/terminalContext.service'
export { ModelProviderService, ModelInfo } from './services/modelProvider.service'
export { AIPanelComponent } from './components/aiPanel.component'
export { AIAssistantConfig, AIProvider } from './config'
