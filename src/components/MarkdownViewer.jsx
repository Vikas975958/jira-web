"use client";

import React from "react";

/**
 * A lightweight, safe Markdown viewer for Jira-like task descriptions.
 * Handles headings, bold, italic, code blocks, lists, blockquotes, and links.
 */
export default function MarkdownViewer({ content = "", className = "" }) {
  if (!content || !content.trim()) {
    return (
      <p className="text-xs text-slate-400 italic">No description provided.</p>
    );
  }

  const lines = content.split("\n");
  const renderedElements = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  lines.forEach((line, index) => {
    // Code block check
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        renderedElements.push(
          <pre
            key={`code-${index}`}
            className="p-3 my-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Headings
    if (line.startsWith("### ")) {
      renderedElements.push(
        <h4
          key={`h4-${index}`}
          className="text-xs font-bold text-slate-900 mt-3 mb-1 uppercase tracking-wider"
        >
          {parseInline(line.replace("### ", ""))}
        </h4>
      );
      return;
    }
    if (line.startsWith("## ")) {
      renderedElements.push(
        <h3
          key={`h3-${index}`}
          className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5"
        >
          {parseInline(line.replace("## ", ""))}
        </h3>
      );
      return;
    }
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h2
          key={`h2-${index}`}
          className="text-base font-bold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200"
        >
          {parseInline(line.replace("# ", ""))}
        </h2>
      );
      return;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      renderedElements.push(
        <blockquote
          key={`quote-${index}`}
          className="pl-3 py-1 my-1.5 border-l-3 border-[#0F766E] text-slate-600 bg-slate-50 rounded-r text-xs italic"
        >
          {parseInline(line.replace("> ", ""))}
        </blockquote>
      );
      return;
    }

    // Unordered list
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      renderedElements.push(
        <li
          key={`li-${index}`}
          className="ml-4 list-disc text-xs text-slate-700 my-0.5 leading-relaxed"
        >
          {parseInline(line.trim().substring(2))}
        </li>
      );
      return;
    }

    // Empty line
    if (!line.trim()) {
      renderedElements.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }

    // Standard paragraph
    renderedElements.push(
      <p
        key={`p-${index}`}
        className="text-xs text-slate-700 leading-relaxed my-1"
      >
        {parseInline(line)}
      </p>
    );
  });

  return (
    <div className={`prose-sm max-w-none text-slate-800 space-y-1 ${className}`}>
      {renderedElements}
    </div>
  );
}

function parseInline(text) {
  if (!text) return "";

  // Split text by tokens for bold, italic, code
  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s]+)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[11px] border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("http")) {
      tokens.push(
        <a
          key={match.index}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0F766E] underline hover:text-[#0D655E] break-all"
        >
          {token}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}
