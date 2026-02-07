import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownProps {
    content: string
    className?: string
}

export function Markdown({ content, className = "" }: MarkdownProps) {
    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Tailwind CSS のクラスを使用して、高齢者の方でも見やすいように調整
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-base lg:text-lg">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-base lg:text-lg">{children}</li>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                    code: ({ children }) => (
                        <code className="bg-muted px-1.5 py-0.5 rounded-md text-sm font-mono">
                            {children}
                        </code>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 italic">
                            {children}
                        </blockquote>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
