import { Injectable } from '@angular/core'
import { Frontend } from 'tabby-terminal'

export interface TerminalContext {
    content: string
    cursorPosition?: { row: number; col: number }
    isAlternateScreen: boolean
    rows: number
    cols: number
}

/**
 * Service to extract context from terminal buffer for AI assistance.
 * Works with XTermFrontend to access the underlying xterm.js buffer.
 */
@Injectable({ providedIn: 'root' })
export class TerminalContextService {
    /**
     * Get the last N lines from the terminal buffer
     */
    getLastNLines (frontend: Frontend, n: number): TerminalContext | null {
        const xterm = this.getXterm(frontend)
        if (!xterm) {
            return null
        }

        const buffer = xterm.buffer.active
        const lines: string[] = []

        // Calculate starting row
        const totalRows = buffer.baseY + buffer.cursorY + 1
        const startRow = Math.max(0, totalRows - n)

        for (let i = startRow; i < totalRows; i++) {
            const line = buffer.getLine(i)
            if (line) {
                lines.push(line.translateToString(true))
            }
        }

        return {
            content: lines.join('\n'),
            cursorPosition: {
                row: buffer.cursorY,
                col: buffer.cursorX,
            },
            isAlternateScreen: buffer.type === 'alternate',
            rows: xterm.rows,
            cols: xterm.cols,
        }
    }

    /**
     * Get the visible content currently displayed in the terminal viewport
     */
    getVisibleContent (frontend: Frontend): TerminalContext | null {
        const xterm = this.getXterm(frontend)
        if (!xterm) {
            return null
        }

        const buffer = xterm.buffer.active
        const lines: string[] = []

        // Get visible rows based on viewport
        const { viewportY } = buffer
        for (let i = 0; i < xterm.rows; i++) {
            const line = buffer.getLine(viewportY + i)
            if (line) {
                lines.push(line.translateToString(true))
            }
        }

        return {
            content: lines.join('\n'),
            cursorPosition: {
                row: buffer.cursorY,
                col: buffer.cursorX,
            },
            isAlternateScreen: buffer.type === 'alternate',
            rows: xterm.rows,
            cols: xterm.cols,
        }
    }

    /**
     * Get the current selection from the terminal, if any
     */
    getSelection (frontend: Frontend): string | null {
        const xterm = this.getXterm(frontend)
        if (!xterm) {
            return null
        }

        const selection = xterm.getSelection()
        return selection && selection.trim().length > 0 ? selection : null
    }

    /**
     * Get content around the cursor - attempts to capture the last command and its output.
     * This is a heuristic approach that looks for common shell prompt patterns.
     */
    getLastCommandContext (frontend: Frontend, maxLines = 100): TerminalContext | null {
        const xterm = this.getXterm(frontend)
        if (!xterm) {
            return null
        }

        const buffer = xterm.buffer.active
        const lines: string[] = []

        // Get last N lines and try to find the start of the last command
        const totalRows = buffer.baseY + buffer.cursorY + 1
        const startRow = Math.max(0, totalRows - maxLines)

        // Collect all lines first
        for (let i = startRow; i < totalRows; i++) {
            const line = buffer.getLine(i)
            if (line) {
                lines.push(line.translateToString(true))
            }
        }

        // Common prompt patterns to detect command start
        // These match the END of a prompt line (before the command)
        const promptPatterns = [
            /[$#>%]\s*$/,           // Common shell prompts
            /\)\s*[$#>%]\s*$/,      // Prompts with parentheses (git branch, etc.)
            /\]\s*[$#>%]\s*$/,      // Prompts with brackets
            /❯\s*$/,                // Fish/Starship prompt
            /➜\s*$/,                // Oh-my-zsh prompt
            /PS[^>]*>\s*$/i,        // PowerShell prompt
            />\s*$/,                // Simple > prompt (cmd.exe, etc.)
        ]

        // Also match prompts that have a command on the same line
        // e.g., "user@host:~$ ls -la" - the prompt + command on one line
        const promptWithCommandPatterns = [
            /[$#>%]\s+\S/,          // Prompt followed by command
            /❯\s+\S/,
            /➜\s+\S/,
            /PS[^>]*>\s+\S/i,
        ]

        // Find the last line that looks like it has a prompt with a command
        // Work backwards from the second-to-last line (last line is often the current prompt)
        let commandStartIndex = -1

        for (let i = lines.length - 2; i >= 0; i--) {
            const line = lines[i]
            const trimmedLine = line.trim()

            if (!trimmedLine) { continue }

            // Check if this line has a prompt with command on the same line
            if (promptWithCommandPatterns.some(p => p.test(line))) {
                commandStartIndex = i
                break
            }

            // Check if this is a bare prompt and the next line has content (the command output started)
            if (promptPatterns.some(p => p.test(trimmedLine))) {
                // This is a prompt line - check if there's content after it
                if (i + 1 < lines.length && lines[i + 1].trim()) {
                    commandStartIndex = i
                    break
                }
            }
        }

        // If we found a command start, return from there to end (but not the last line if it's a new prompt)
        let relevantLines: string[] = []
        if (commandStartIndex >= 0) {
            relevantLines = lines.slice(commandStartIndex)

            // Remove the last line if it's just an empty prompt
            const lastLine = relevantLines[relevantLines.length - 1]?.trim()
            if (lastLine && promptPatterns.some(p => p.test(lastLine)) && !promptWithCommandPatterns.some(p => p.test(lastLine))) {
                relevantLines = relevantLines.slice(0, -1)
            }
        } else {
            // Fallback: just return last 20 lines
            relevantLines = lines.slice(-20)
        }

        return {
            content: relevantLines.join('\n'),
            cursorPosition: {
                row: buffer.cursorY,
                col: buffer.cursorX,
            },
            isAlternateScreen: buffer.type === 'alternate',
            rows: xterm.rows,
            cols: xterm.cols,
        }
    }

    /**
     * Get the entire scrollback buffer (use with caution - can be large)
     */
    getFullBuffer (frontend: Frontend, maxLines = 1000): TerminalContext | null {
        const xterm = this.getXterm(frontend)
        if (!xterm) {
            return null
        }

        const buffer = xterm.buffer.active
        const lines: string[] = []

        const totalRows = buffer.baseY + buffer.cursorY + 1
        const startRow = Math.max(0, totalRows - maxLines)

        for (let i = startRow; i < totalRows; i++) {
            const line = buffer.getLine(i)
            if (line) {
                lines.push(line.translateToString(true))
            }
        }

        return {
            content: lines.join('\n'),
            cursorPosition: {
                row: buffer.cursorY,
                col: buffer.cursorX,
            },
            isAlternateScreen: buffer.type === 'alternate',
            rows: xterm.rows,
            cols: xterm.cols,
        }
    }

    /**
     * Helper to extract the xterm instance from a Frontend.
     * Returns null if the frontend is not XTermFrontend or not ready.
     */
    private getXterm (frontend: Frontend): any | null {
        // Access the xterm instance - XTermFrontend exposes it as a public property
        // Cast to any because Frontend interface doesn't expose xterm directly
        const xtermFrontend = frontend as any
        if (xtermFrontend?.xterm) {
            return xtermFrontend.xterm
        }

        return null
    }
}
