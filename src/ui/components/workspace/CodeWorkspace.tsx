import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeWorkspaceProps {
  content: string;
  language?: string;
}

const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ content, language = "typescript" }) => {
  const [copied, setCopied] = useState(false);

  // Extract code blocks from markdown
  const codeBlocks = extractCodeBlocks(content);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (codeBlocks.length === 0) {
    return (
      <div className="rounded-b-lg overflow-hidden">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: "0 0 8px 8px", fontSize: "13px" }}
          showLineNumbers
        >
          {content}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {codeBlocks.map((block, idx) => (
        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-700/50">
          {/* Language badge */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700/50">
            <span className="text-xs text-gray-400 font-mono">{block.language || language}</span>
            <button
              onClick={() => handleCopy(block.code)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <SyntaxHighlighter
            language={block.language || language}
            style={vscDarkPlus}
            customStyle={{ margin: 0, fontSize: "13px", maxHeight: "500px" }}
            showLineNumbers
          >
            {block.code}
          </SyntaxHighlighter>
        </div>
      ))}

      {/* Non-code text */}
      {codeBlocks.some((b) => b.surrounding) && (
        <div className="px-2 py-1 text-sm text-gray-300 leading-relaxed">
          {codeBlocks
            .filter((b) => b.surrounding)
            .map((b, i) => (
              <p key={i} className="mb-2">
                {b.surrounding}
              </p>
            ))}
        </div>
      )}
    </div>
  );
};

function extractCodeBlocks(
  content: string
): Array<{ code: string; language: string; surrounding?: string }> {
  const blocks: Array<{ code: string; language: string; surrounding?: string }> = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    const surrounding = content.slice(lastIndex, match.index).trim();
    blocks.push({
      code: match[2].trim(),
      language: match[1] || "text",
      surrounding: surrounding || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  if (blocks.length === 0) {
    blocks.push({ code: content, language: "text" });
  }

  return blocks;
}

export default CodeWorkspace;
