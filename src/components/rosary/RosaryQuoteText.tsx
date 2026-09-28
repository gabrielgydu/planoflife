import type { RosaryQuote } from '../../data/rosary'

/** A contemplation passage (paragraphs split on "\n") followed by its source. */
export function RosaryQuoteText({ quote, textClassName }: { quote: RosaryQuote; textClassName: string }) {
  return (
    <figure className="space-y-2">
      <blockquote className="space-y-2">
        {quote.t.split('\n').map((para, i) => (
          <p key={i} className={`italic text-text-secondary dark:text-text-secondary-dark leading-relaxed ${textClassName}`}>
            {para}
          </p>
        ))}
      </blockquote>
      <figcaption className="text-xs text-text-muted dark:text-text-muted-dark">— {quote.ref}</figcaption>
    </figure>
  )
}
