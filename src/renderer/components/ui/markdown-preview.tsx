import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  content: string;
  emptyText: string;
  className?: string;
  bodyClassName?: string;
  emptyClassName?: string;
}

function MarkdownPreview({ content, emptyText, className, bodyClassName, emptyClassName }: MarkdownPreviewProps) {
  const hasContent = content.trim().length > 0;

  return (
    <div className={cn('rounded-[1.5rem] border border-border/70 bg-background/35', className)}>
      {hasContent ? (
        <div className={cn('max-h-[60vh] min-h-[30rem] overflow-auto px-5 py-5', bodyClassName)}>
          <div className="markdown-preview prose-reset text-sm leading-7 text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ className: nextClassName, ...props }) => <h1 className={cn('mt-0 text-3xl font-semibold tracking-tight text-foreground', nextClassName)} {...props} />,
                h2: ({ className: nextClassName, ...props }) => <h2 className={cn('mt-8 text-2xl font-semibold text-foreground', nextClassName)} {...props} />,
                h3: ({ className: nextClassName, ...props }) => <h3 className={cn('mt-6 text-xl font-semibold text-foreground', nextClassName)} {...props} />,
                h4: ({ className: nextClassName, ...props }) => <h4 className={cn('mt-5 text-base font-semibold text-foreground', nextClassName)} {...props} />,
                p: ({ className: nextClassName, ...props }) => <p className={cn('my-4 text-sm leading-7 text-foreground/92', nextClassName)} {...props} />,
                a: ({ className: nextClassName, ...props }) => <a className={cn('text-primary underline decoration-primary/40 underline-offset-4', nextClassName)} target="_blank" rel="noreferrer" {...props} />,
                ul: ({ className: nextClassName, ...props }) => <ul className={cn('my-4 list-disc space-y-2 pl-6 text-foreground/92', nextClassName)} {...props} />,
                ol: ({ className: nextClassName, ...props }) => <ol className={cn('my-4 list-decimal space-y-2 pl-6 text-foreground/92', nextClassName)} {...props} />,
                li: ({ className: nextClassName, ...props }) => <li className={cn('pl-1', nextClassName)} {...props} />,
                blockquote: ({ className: nextClassName, ...props }) => <blockquote className={cn('my-5 rounded-r-xl border-l border-border/80 bg-background/40 px-4 py-3 text-muted-foreground', nextClassName)} {...props} />,
                hr: ({ className: nextClassName, ...props }) => <hr className={cn('my-6 border-border/80', nextClassName)} {...props} />,
                code: ({ className: nextClassName, children, ...props }) => {
                  const isInline = !(nextClassName ?? '').includes('language-');
                  if (isInline) {
                    return (
                      <code
                        className={cn('rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[0.9em] text-primary', nextClassName)}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <code className={cn('font-mono text-[13px] text-foreground', nextClassName)} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ className: nextClassName, ...props }) => <pre className={cn('my-5 overflow-x-auto rounded-2xl border border-border/70 bg-background/70 px-4 py-4 font-mono text-[13px] leading-6 text-foreground', nextClassName)} {...props} />,
                table: ({ className: nextClassName, ...props }) => <div className="my-5 overflow-x-auto"><table className={cn('min-w-full border-collapse overflow-hidden rounded-xl border border-border/70', nextClassName)} {...props} /></div>,
                thead: ({ className: nextClassName, ...props }) => <thead className={cn('bg-background/60', nextClassName)} {...props} />,
                th: ({ className: nextClassName, ...props }) => <th className={cn('border-b border-border/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground', nextClassName)} {...props} />,
                td: ({ className: nextClassName, ...props }) => <td className={cn('border-t border-border/50 px-3 py-2 align-top text-sm text-foreground/92', nextClassName)} {...props} />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className={cn('flex min-h-[30rem] items-center justify-center px-6 py-8 text-center text-sm leading-6 text-muted-foreground', emptyClassName)}>
          {emptyText}
        </div>
      )}
    </div>
  );
}

export { MarkdownPreview };
