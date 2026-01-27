import { Injectable } from '@angular/core'
import { HotkeyDescription, HotkeyProvider, TranslateService } from 'tabby-core'

@Injectable()
export class AIAssistantHotkeyProvider extends HotkeyProvider {
    constructor (
        private translate: TranslateService,
    ) { super() }

    async provide (): Promise<HotkeyDescription[]> {
        return [
            {
                id: 'toggle-ai-panel',
                name: this.translate.instant('Toggle AI Assistant Panel'),
            },
        ]
    }
}
