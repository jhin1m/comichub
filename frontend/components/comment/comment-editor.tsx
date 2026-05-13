'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

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
  const [charCount, setCharCount] = useState(0);
  const [focused, setFocused] = useState(false);
  const MAX_CHARS = 2000;

  const showFooter = focused || charCount > 0;

  const onUpdate = useCallback(
    ({ editor: e }: { editor: { getText: () => string } }) => {
      setCharCount(e.getText().length);
    },
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
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

  if (!isLoggedIn) {
    return (
      <div className="rounded-lg p-3 text-center text-secondary text-xs bg-surface/50">
        <a href="/login" className="text-accent hover:underline">
          Login
        </a>{' '}
        to post a comment.
      </div>
    );
  }

  return (
    <div>
      <div className="bg-elevated/60 rounded-lg">
        <EditorContent editor={editor} />
      </div>

      {showFooter && (
        <div className="flex items-center justify-end gap-3 mt-1.5">
          {charCount > 0 && (
            <span
              className={cn(
                'text-[10px]',
                charCount > MAX_CHARS ? 'text-accent' : 'text-muted',
              )}
            >
              {charCount}/{MAX_CHARS}
            </span>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={submitting}
              className="text-xs text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || charCount === 0 || charCount > MAX_CHARS}
            className="px-4 py-1 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-40 transition-colors"
          >
            {submitting ? '...' : initialContent ? 'Save' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
