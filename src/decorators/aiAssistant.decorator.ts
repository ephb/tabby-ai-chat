import { Injectable, ComponentRef, Injector, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core'
import { HotkeysService, ConfigService } from 'tabby-core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { AIPanelComponent } from '../components/aiPanel.component'

/**
 * Decorator that attaches the AI Assistant panel to terminal tabs.
 * Uses hotkey to toggle the panel visibility.
 */
@Injectable()
export class AIAssistantDecorator extends TerminalDecorator {
    private panelRefs = new Map<BaseTerminalTabComponent<any>, ComponentRef<AIPanelComponent>>()
    private panelVisible = new Map<BaseTerminalTabComponent<any>, boolean>()

    constructor (
        private hotkeys: HotkeysService,
        private config: ConfigService,
        private appRef: ApplicationRef,
        private injector: Injector,
        private envInjector: EnvironmentInjector,
    ) {
        super()
    }

    attach (terminal: BaseTerminalTabComponent<any>): void {
        // Subscribe to hotkey to toggle AI panel
        this.subscribeUntilDetached(
            terminal,
            this.hotkeys.hotkey$.subscribe(hotkey => {
                if (hotkey === 'toggle-ai-panel' && terminal.hasFocus) {
                    this.togglePanel(terminal)
                }
            }),
        )
    }

    detach (terminal: BaseTerminalTabComponent<any>): void {
        this.destroyPanel(terminal)
        this.panelVisible.delete(terminal)
        super.detach(terminal)
    }

    private togglePanel (terminal: BaseTerminalTabComponent<any>): void {
        const isVisible = this.panelVisible.get(terminal) ?? false

        if (isVisible) {
            this.hidePanel(terminal)
        } else {
            this.showPanel(terminal)
        }
    }

    private showPanel (terminal: BaseTerminalTabComponent<any>): void {
        if (this.panelRefs.has(terminal)) {
            // Panel already exists, just show it
            const ref = this.panelRefs.get(terminal)!
            ref.location.nativeElement.style.display = 'flex'
            this.panelVisible.set(terminal, true)
            this.updateTerminalLayout(terminal, true)
            return
        }

        // Create the AI panel component
        const panelRef = createComponent(AIPanelComponent, {
            environmentInjector: this.envInjector,
            elementInjector: this.injector,
        })

        // Set inputs
        panelRef.instance.frontend = terminal.frontend

        // Handle outputs
        panelRef.instance.closed.subscribe(() => {
            this.hidePanel(terminal)
        })

        panelRef.instance.insertCommand.subscribe((cmd: string) => {
            this.insertCommandIntoTerminal(terminal, cmd)
        })

        panelRef.instance.executeCommand.subscribe((cmd: string) => {
            this.executeCommandInTerminal(terminal, cmd)
        })

        // Attach to the terminal's host element
        const hostElement = terminal.element.nativeElement
        const panelElement = panelRef.location.nativeElement

        // Style the panel
        const widthPercent = this.config.store.aiAssistant?.panelWidthPercent ?? 40
        panelElement.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: ${widthPercent}%;
            height: 100%;
            z-index: 100;
            display: flex;
            flex-direction: column;
            pointer-events: auto;
            background: var(--theme-bg);
        `

        hostElement.appendChild(panelElement)
        this.appRef.attachView(panelRef.hostView)

        this.panelRefs.set(terminal, panelRef)
        this.panelVisible.set(terminal, true)

        // Update terminal layout to make room for panel
        this.updateTerminalLayout(terminal, true)

        // Detect changes
        panelRef.changeDetectorRef.detectChanges()
    }

    private hidePanel (terminal: BaseTerminalTabComponent<any>): void {
        const ref = this.panelRefs.get(terminal)
        if (ref) {
            ref.location.nativeElement.style.display = 'none'
        }
        this.panelVisible.set(terminal, false)
        this.updateTerminalLayout(terminal, false)

        // Refocus terminal
        terminal.frontend?.focus()
    }

    private destroyPanel (terminal: BaseTerminalTabComponent<any>): void {
        const ref = this.panelRefs.get(terminal)
        if (ref) {
            this.appRef.detachView(ref.hostView)
            ref.destroy()
            this.panelRefs.delete(terminal)
        }
    }

    private updateTerminalLayout (terminal: BaseTerminalTabComponent<any>, panelVisible: boolean): void {
        // Get the terminal's content element
        const contentEl = terminal.element.nativeElement.querySelector('.content') as HTMLElement | null
        if (contentEl) {
            if (panelVisible) {
                const widthPercent = this.config.store.aiAssistant?.panelWidthPercent ?? 40
                contentEl.style.width = `${100 - widthPercent}%`
            } else {
                contentEl.style.width = '100%'
            }
        }

        // Trigger terminal resize after layout change
        setTimeout(() => {
            // Access xterm resize via the frontend if available
            const frontend = terminal.frontend as any
            if (frontend?.resizeHandler) {
                frontend.resizeHandler()
            }
        }, 100)
    }

    private insertCommandIntoTerminal (terminal: BaseTerminalTabComponent<any>, command: string): void {
        // Insert command without executing (don't add newline)
        terminal.sendInput(command)
        terminal.frontend?.focus()
    }

    private executeCommandInTerminal (terminal: BaseTerminalTabComponent<any>, command: string): void {
        // Execute command (add newline to run it)
        terminal.sendInput(command + '\r')
        terminal.frontend?.focus()
    }
}
