import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  children: string;
}

export function Markdown({ children }: MarkdownProps) {
  return <div className="prose prose-invert prose-sm max-w-none">{children && <ReactMarkdown>{children}</ReactMarkdown>}</div>;
}
