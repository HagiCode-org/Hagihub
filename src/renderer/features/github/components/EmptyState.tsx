import { Github, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onAddAccount: () => void;
}

function EmptyState({ onAddAccount }: EmptyStateProps) {
  const { t } = useTranslation('github');

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-background/45 p-6 sm:p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-5">
        <span className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary">
          <Github className="size-6" />
        </span>
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('emptyState.title')}</h3>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{t('emptyState.description')}</p>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">{t('emptyState.secondary')}</p>
        </div>
        <Button size="lg" onClick={onAddAccount}>
          <Plus /> {t('workspace.addAccount')}
        </Button>
      </div>
    </div>
  );
}

export default EmptyState;
