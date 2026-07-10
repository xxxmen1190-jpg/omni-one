import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownWorkspaceProps {
  content: string;
  minimal?: boolean;
}

const MarkdownWorkspace: React.FC<MarkdownWorkspaceProps> = ({ content, minimal = false }) => {
  return (
    <div
      className={`markdown-workspace ${
        minimal ? "px-0 py-0" : "px-4 py-3"
      } text-ink-200 leading-relaxed`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            return isInline ? (
              <code
                className="bg-ink-800 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            ) : (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: "8px", fontSize: "13px", margin: "8px 0" }}
                showLineNumbers
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-white mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-white mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-ink-100 mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 text-ink-200">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-ink-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-ink-200">{children}</ol>
          ),
          li: ({ children }) => <li className="text-ink-200">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500 pl-4 py-1 my-3 text-ink-400 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-sm border-collapse border border-ink-700">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-ink-700 px-3 py-2 bg-ink-800 text-left font-semibold text-ink-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-ink-700 px-3 py-2 text-ink-300">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-ink-300">{children}</em>,
          hr: () => <hr className="border-ink-700 my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownWorkspace;
