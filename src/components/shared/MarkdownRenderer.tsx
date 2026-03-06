import { useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownRendererProps {
  markdown: string
  className?: string
}

export function MarkdownRenderer({ markdown, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    return marked.parse(markdown, { async: false, breaks: true }) as string
  }, [markdown])

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
