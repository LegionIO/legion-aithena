import { type FC, type ReactNode, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { RefreshCwIcon } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

const rehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'video'],
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...((defaultSchema.attributes?.img as string[] | undefined) || []),
      'alt',
      'title',
      'width',
      'height',
    ],
    video: ['src', 'controls', 'title', 'width', 'height', 'autoplay', 'loop', 'muted', 'preload', 'poster'],
    source: ['src', 'type', 'media', 'sizes', 'srcSet', 'srcset'],
  },
};

const ChatImage: FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ alt, src, ...props }) => {
  const [reloadKey, setReloadKey] = useState(0);

  const handleReload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  // Append cache-buster on reload
  const imgSrc = src ? (reloadKey > 0 ? `${src}${src.includes('?') ? '&' : '?'}_r=${reloadKey}` : src) : undefined;

  return (
    <div className="relative inline-block group">
      <img
        alt={alt ?? ''}
        src={imgSrc}
        className="my-2 max-w-full rounded-lg object-contain"
        loading="lazy"
        {...props}
      />
      {/* Reload button overlay */}
      <button
        type="button"
        onClick={handleReload}
        className="absolute top-3 right-1 opacity-0 group-hover:opacity-80 transition-opacity bg-black/60 hover:bg-black/80 text-white rounded-md p-1"
        title="Reload image"
      >
        <RefreshCwIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

/* ── Stable component overrides (hoisted to avoid re-mount on every render) ── */

const MdP: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <p {...props}>{children}</p>
);
const MdLi: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <li {...props}>{children}</li>
);
const MdH1: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <h1 {...props}>{children}</h1>
);
const MdH2: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <h2 {...props}>{children}</h2>
);
const MdH3: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <h3 {...props}>{children}</h3>
);
const MdStrong: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <strong {...props}>{children}</strong>
);
const MdEm: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <em {...props}>{children}</em>
);
const MdPre: FC<{ children?: ReactNode }> = ({ children }) => {
  const codeEl = Array.isArray(children) ? children[0] : children;
  if (codeEl && typeof codeEl === 'object' && 'props' in codeEl) {
    const { className, children: codeChildren } = codeEl.props as { className?: string; children?: unknown };
    const lang = className?.replace(/^language-/, '') || undefined;
    const text = typeof codeChildren === 'string' ? codeChildren : String(codeChildren ?? '');
    return <div className="my-4"><CodeBlock code={text.replace(/\n$/, '')} language={lang} /></div>;
  }
  return <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-xs">{children}</pre>;
};
const MdCode: FC<{ children?: ReactNode; className?: string } & Record<string, unknown>> = ({ children, className, ...props }) => {
  const isInline = !className;
  if (isInline) {
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    );
  }
  return <code className={className} {...props}>{children}</code>;
};
const MdA: FC<{ children?: ReactNode; href?: string } & Record<string, unknown>> = ({ children, href, ...props }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline" {...props}>
    {children}
  </a>
);
const MdImg: FC<{ node?: unknown } & React.ImgHTMLAttributes<HTMLImageElement>> = ({ node: _node, ...imgProps }) => <ChatImage {...imgProps} />;
const MdVideo: FC<{ children?: ReactNode; controls?: boolean } & Record<string, unknown>> = ({ children, ...props }) => (
  <video
    controls={props.controls ?? true}
    className="my-2 max-w-full rounded-lg"
    {...props}
  >
    {children}
  </video>
);
const MdTable: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <div className="overflow-x-auto">
    <table className="border-collapse border border-border text-xs" {...props}>
      {children}
    </table>
  </div>
);
const MdTh: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <th className="border border-border bg-muted px-2 py-1 text-left text-xs font-semibold" {...props}>
    {children}
  </th>
);
const MdTd: FC<{ children?: ReactNode } & Record<string, unknown>> = ({ children, ...props }) => (
  <td className="border border-border px-2 py-1 text-xs" {...props}>
    {children}
  </td>
);

const markdownComponents = {
  p: MdP,
  li: MdLi,
  h1: MdH1,
  h2: MdH2,
  h3: MdH3,
  strong: MdStrong,
  em: MdEm,
  pre: MdPre,
  code: MdCode,
  a: MdA,
  img: MdImg,
  video: MdVideo,
  table: MdTable,
  th: MdTh,
  td: MdTd,
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw, [rehypeSanitize, rehypeSanitizeOptions]] as any[];

export const MarkdownText: FC<{ text: string }> = memo(({ text }) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents as any}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
