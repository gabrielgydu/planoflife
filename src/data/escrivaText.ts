// The plain text of a bundled Escrivá point, for search and one-line quotes.
//
// The points ship as a deliberately tiny markdown dialect (see
// scripts/build-escriva-points.mjs): paragraphs split by a blank line, italics and
// bold as literal <em>/<strong> tags, the closing scripture-citation block in a
// <small>, and every character markdown would otherwise act on backslash-escaped
// (or, for `<` and `&`, entity-escaped). Undoing exactly that is all it takes to
// get the words back.
//
// No imports on purpose: the build script imports this file directly (Node strips
// the types) and checks it against every point it writes, so this function and
// the shipped JSON cannot drift apart unnoticed.

/** Heading of the scripture-citation block some points end with. */
export const REF_HEADING = 'Referências da Sagrada Escritura'

/** The point as text: tags dropped, escapes undone, paragraphs kept as "\n\n". */
export function pointPlainText(markdown: string): string {
  return markdown
    .replace(/<\/?(?:em|strong|small)>/g, '')
    .replace(/\\([\\`*_[\]#+\-.)~|>=])/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}
