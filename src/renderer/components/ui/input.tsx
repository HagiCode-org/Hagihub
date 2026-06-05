import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-border/70 bg-background/45 px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
