import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

type MarkdownMessageProps = {
  content: string;
};

function normalizeContent(content: string) {
  return (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const safeContent = normalizeContent(content);

  if (!safeContent) {
    return null;
  }

  return (
    <div className="oddix-markdown w-full max-w-none text-white/88">
      <style jsx global>{`
        .oddix-markdown {
          line-height: 1.78;
        }

        .oddix-markdown > :first-child {
          margin-top: 0 !important;
        }

        .oddix-markdown > :last-child {
          margin-bottom: 0 !important;
        }

        .oddix-markdown h1,
        .oddix-markdown h2,
        .oddix-markdown h3 {
          color: #ecfff7;
          font-weight: 850;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin: 1.15rem 0 0.55rem;
        }

        .oddix-markdown h1 {
          font-size: 1.35rem;
        }

        .oddix-markdown h2 {
          font-size: 1.16rem;
        }

        .oddix-markdown h3 {
          font-size: 1rem;
        }

        .oddix-markdown p {
          margin: 0.65rem 0;
          color: rgba(236, 255, 247, 0.88);
        }

        .oddix-markdown strong {
          color: #d1fae5;
          font-weight: 850;
        }

        .oddix-markdown em {
          color: rgba(167, 243, 208, 0.92);
        }

        .oddix-markdown ul,
        .oddix-markdown ol {
          margin: 0.75rem 0;
          padding-left: 1.3rem;
        }

        .oddix-markdown li {
          margin: 0.28rem 0;
          padding-left: 0.15rem;
        }

        .oddix-markdown li::marker {
          color: #10b981;
        }

        .oddix-markdown blockquote {
          margin: 1rem 0;
          border-left: 3px solid rgba(16, 185, 129, 0.7);
          border-radius: 0 16px 16px 0;
          background: rgba(16, 185, 129, 0.08);
          padding: 0.85rem 1rem;
          color: rgba(236, 255, 247, 0.82);
        }

        .oddix-markdown table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          margin: 1rem 0;
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 18px;
          background: rgba(16, 25, 34, 0.72);
          font-size: 0.9rem;
        }

        .oddix-markdown thead {
          background: rgba(16, 185, 129, 0.12);
        }

        .oddix-markdown th,
        .oddix-markdown td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          padding: 0.7rem 0.8rem;
          text-align: left;
          vertical-align: top;
        }

        .oddix-markdown tr:last-child td {
          border-bottom: 0;
        }

        .oddix-markdown th {
          color: #a7f3d0;
          font-weight: 850;
          white-space: nowrap;
        }

        .oddix-markdown td {
          color: rgba(236, 255, 247, 0.84);
        }

        .oddix-markdown code {
          border: 1px solid rgba(16, 185, 129, 0.16);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.28);
          color: #a7f3d0;
          padding: 0.12rem 0.35rem;
          font-size: 0.88em;
        }

        .oddix-markdown pre {
          overflow-x: auto;
          margin: 1rem 0;
          border: 1px solid rgba(16, 185, 129, 0.18);
          border-radius: 18px;
          background: #071018;
          padding: 1rem;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        .oddix-markdown pre code {
          border: 0;
          background: transparent;
          padding: 0;
          color: #d1fae5;
          font-size: 0.88rem;
          line-height: 1.65;
        }

        .oddix-markdown a {
          color: #34d399;
          text-decoration: none;
          font-weight: 700;
        }

        .oddix-markdown a:hover {
          text-decoration: underline;
        }

        .oddix-markdown hr {
          margin: 1.25rem 0;
          border: 0;
          border-top: 1px solid rgba(16, 185, 129, 0.18);
        }

        @media (max-width: 640px) {
          .oddix-markdown table {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
          }

          .oddix-markdown h1 {
            font-size: 1.18rem;
          }

          .oddix-markdown h2 {
            font-size: 1.05rem;
          }
        }
      `}</style>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}
