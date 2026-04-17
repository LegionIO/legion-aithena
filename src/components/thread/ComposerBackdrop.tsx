import { useState, useEffect, useRef, type FC } from 'react';

/**
 * Grid-overlay backdrop for the composer textarea.
 * Place this AND the textarea in the same CSS Grid cell (gridArea: '1/1').
 * The textarea renders with transparent text + visible caret.
 * This renders the same text as a backdrop to keep wrapping/scroll in sync.
 */
export const ComposerBackdrop: FC = () => {
  const [text, setText] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const detachRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const attach = (textarea: HTMLTextAreaElement) => {
      const sync = () => {
        setText(textarea.value);
        setScrollTop(textarea.scrollTop);
      };
      sync();
      textarea.addEventListener('input', sync);
      textarea.addEventListener('scroll', sync);
      return () => {
        textarea.removeEventListener('input', sync);
        textarea.removeEventListener('scroll', sync);
      };
    };

    const textarea = document.querySelector('.app-composer-grid textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      detachRef.current = attach(textarea);
      return () => detachRef.current?.();
    }

    // Textarea not mounted yet — observe DOM until it appears
    const observer = new MutationObserver(() => {
      const el = document.querySelector('.app-composer-grid textarea') as HTMLTextAreaElement | null;
      if (el) {
        observer.disconnect();
        detachRef.current = attach(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      detachRef.current?.();
    };
  }, []);

  return (
    <div
      className="pointer-events-none select-none overflow-hidden whitespace-pre-wrap break-words text-sm py-1.5"
      style={{
        gridArea: '1 / 1',
        transform: `translateY(-${scrollTop}px)`,
        color: 'var(--foreground)',
        WebkitTextFillColor: 'var(--foreground)',
      }}
      aria-hidden
    >
      {text
        ? text.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && '\n'}
            </span>
          ))
        : null}
    </div>
  );
};
