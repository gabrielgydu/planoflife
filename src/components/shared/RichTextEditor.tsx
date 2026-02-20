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
      <div className="min-h-[200px] p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
        <span className="text-slate-400">Carregando editor...</span>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
            editor.isActive('bold') ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          title="Negrito"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
            editor.isActive('italic') ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          title="Itálico"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
            editor.isActive('bulletList') ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          title="Lista"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
            editor.isActive('orderedList') ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 dark:bg-slate-700' : ''
          }`}
          title="Título"
        >
          <Type className="w-4 h-4" />
        </button>
      </div>

      <EditorContent
        editor={editor}
        className="bg-white dark:bg-slate-900"
        placeholder={placeholder}
      />
    </div>
  )
}
