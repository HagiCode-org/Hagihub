import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-[0.18em] uppercase transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/12 text-primary',
        secondary: 'border-border/70 bg-secondary text-secondary-foreground',
        outline: 'border-border/70 bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
