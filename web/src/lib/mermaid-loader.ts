type MermaidRenderResult = {
  svg: string
  bindFunctions?: (element: Element) => void
}

export type MermaidApi = {
  initialize(config: Record<string, unknown>): void
  render(id: string, chart: string): Promise<MermaidRenderResult>
}

declare global {
  interface Window {
    mermaid?: MermaidApi
    __llmwikiMermaidPromise?: Promise<MermaidApi>
  }
}

const MERMAID_SCRIPT_ID = 'llmwiki-mermaid-script'
const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'

export function loadMermaid(): Promise<MermaidApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid can only be loaded in the browser'))
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid)
  }

  if (window.__llmwikiMermaidPromise) {
    return window.__llmwikiMermaidPromise
  }

  window.__llmwikiMermaidPromise = new Promise<MermaidApi>((resolve, reject) => {
    const resolveMermaid = () => {
      if (!window.mermaid) return false
      resolve(window.mermaid)
      return true
    }

    const rejectMermaid = (message: string) => {
      window.__llmwikiMermaidPromise = undefined
      reject(new Error(message))
    }

    const existingScript = document.getElementById(MERMAID_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      if (resolveMermaid()) return

      existingScript.addEventListener('load', () => {
        if (!resolveMermaid()) rejectMermaid('Mermaid script loaded without exposing window.mermaid')
      }, { once: true })
      existingScript.addEventListener('error', () => {
        rejectMermaid('Failed to load Mermaid script')
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = MERMAID_SCRIPT_ID
    script.src = MERMAID_CDN_URL
    script.async = true
    script.onload = () => {
      if (!resolveMermaid()) rejectMermaid('Mermaid script loaded without exposing window.mermaid')
    }
    script.onerror = () => rejectMermaid('Failed to load Mermaid script')
    document.head.appendChild(script)
  })

  return window.__llmwikiMermaidPromise
}
