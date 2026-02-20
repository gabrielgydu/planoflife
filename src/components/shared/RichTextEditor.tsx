import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { Bold, Italic, List, ListOrdered, Type } from 'lucide-react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return (
      <div className="min-h-[200px] p-4 bg-surface-secondary dark:bg-surface-secondary-dark rounded-lg flex items-center justify-center">
        <span className="text-text-muted">Carregando editor...</span>
      </div>
    )
  }

  return (
    <div className="border border-border dark:border-border-dark rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 p-2 border-b border-border dark:border-border-dark bg-surface-secondary dark:bg-surface-secondary-dark">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-border dark:hover:bg-border-dark transition-colors ${
            editor.isActive('bold') ? 'bg-border dark:bg-border-dark' : ''
          }`}
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-border dark:hover:bg-border-dark transition-colors ${
            editor.isActive('italic') ? 'bg-border dark:bg-border-dark' : ''
          }`}
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border dark:bg-border-dark mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-border dark:hover:bg-border-dark transition-colors ${
            editor.isActive('bulletList') ? 'bg-border dark:bg-border-dark' : ''
          }`}
          title="Lista"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-border dark:hover:bg-border-dark transition-colors ${
            editor.isActive('orderedList') ? 'bg-border dark:bg-border-dark' : ''
          }`}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border dark:bg-border-dark mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-border dark:hover:bg-border-dark transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-border dark:bg-border-dark' : ''
          }`}
          title="Título"
        >
          <Type className="w-4 h-4" />
        </button>
      </div>

      <EditorContent
        editor={editor}
        className="bg-surface-card dark:bg-surface-dark"
        placeholder={placeholder}
      />
    </div>
  )
}
