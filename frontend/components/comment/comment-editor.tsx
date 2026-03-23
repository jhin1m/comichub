'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Mark, mergeAttributes } from '@tiptap/core';
import { useState, useCallback } from 'react';
import { Bold, Quote, EyeOff, Image as ImageIcon, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const Spoiler = Mark.create({
  name: 'spoiler',
  parseHTML() {
    return [{ tag: 'span.spoiler' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'spoiler' }, HTMLAttributes), 0];
  },
});

interface CommentEditorProps {
  onSubmit: (html: string) => Promise<void>;
  onCancel?: () => void;
  initialContent?: string;
  placeholder?: string;
  compact?: boolean;
  isLoggedIn?: boolean;
}

export function CommentEditor({
  onSubmit,
  onCancel,
  initialContent = '',
  placeholder = 'Write your message',
  compact = false,
  isLoggedIn = true,
}: CommentEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 2000;

  const onUpdate = useCallback(({ editor: e }: { editor: { getText: () => string } }) => {
    setCharCount(e.getText().length);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Image.configure({ inline: true, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Spoiler,
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert prose-sm max-w-none px-3 py-2 focus:outline-none text-primary text-sm',
          compact ? 'min-h-[50px]' : 'min-h-[70px]',
        ),
      },
    },
  });

  const handleSubmit = async () => {
    if (!editor || submitting) return;
    const html = editor.getHTML();
    if (!html || html === '<p></p>') return;
    setSubmitting(true);
    try {
      await onSubmit(html);
      editor.commands.clearContent();
      setCharCount(0);
    } catch {
      // Error handled by parent — don't clear content
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddImage = () => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageInput(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="rounded-lg p-3 text-center text-secondary text-xs bg-surface/50">
        <a href="/login" className="text-accent hover:underline">Login</a> to post a comment.
      </div>
    );
  }

  return (
    <div>
      <div className="bg-elevated/60 rounded-lg">
        <EditorContent editor={editor} />
      </div>

      {showImageInput && (
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            className="flex-1 bg-elevated border border-default rounded px-2 py-1 text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
            autoFocus
          />
          <button onClick={handleAddImage} disabled={!imageUrl} className="text-xs text-accent hover:text-accent-hover disabled:opacity-40">Add</button>
          <button onClick={() => { setShowImageInput(false); setImageUrl(''); }} className="text-xs text-secondary hover:text-primary">Cancel</button>
        </div>
      )}

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
            className={cn(
              'p-1.5 rounded text-secondary hover:text-primary transition-colors',
              editor?.isActive('bold') && 'text-primary',
            )}
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            aria-label="Quote"
            className={cn(
              'p-1.5 rounded text-secondary hover:text-primary transition-colors',
              editor?.isActive('blockquote') && 'text-primary',
            )}
          >
            <Quote size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleMark('spoiler').run()}
            aria-label="Spoiler"
            className={cn(
              'p-1.5 rounded text-secondary hover:text-primary transition-colors',
              editor?.isActive('spoiler') && 'text-primary',
            )}
          >
            <EyeOff size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            aria-label="Add image"
            className={cn(
              'p-1.5 rounded text-secondary hover:text-primary transition-colors',
              showImageInput && 'text-primary',
            )}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            aria-label="Preview"
            className="p-1.5 rounded text-secondary hover:text-primary transition-colors"
          >
            <Eye size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {charCount > 0 && (
            <span className={cn('text-[10px]', charCount > MAX_CHARS ? 'text-accent' : 'text-muted')}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
          {onCancel && (
            <button onClick={onCancel} disabled={submitting} className="text-xs text-secondary hover:text-primary transition-colors">
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || charCount === 0 || charCount > MAX_CHARS}
            className="px-4 py-1 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-40 transition-colors"
          >
            {submitting ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
