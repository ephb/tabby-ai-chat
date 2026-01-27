import { Pipe, PipeTransform } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { marked } from 'marked'

/**
 * Pipe to render markdown content as HTML.
 * Uses the marked library for parsing.
 */
@Pipe({
    name: 'aiMarkdown',
})
export class AIMarkdownPipe implements PipeTransform {
    constructor (private sanitizer: DomSanitizer) {
        // Configure marked options
        marked.setOptions({
            gfm: true,
            breaks: true,
        })
    }

    transform (content: string): SafeHtml {
        if (!content) {
            return ''
        }

        try {
            // Parse markdown to HTML
            const html = marked.parse(content, { async: false }) as string

            // Sanitize and return
            // Note: In production, you might want additional sanitization
            return this.sanitizer.bypassSecurityTrustHtml(html)
        } catch (error) {
            console.error('Markdown parsing error:', error)
            // Fall back to escaped plain text
            return this.escapeHtml(content)
        }
    }

    private escapeHtml (text: string): string {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }
}
