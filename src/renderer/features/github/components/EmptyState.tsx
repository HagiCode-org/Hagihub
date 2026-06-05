import { Github, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onAddAccount: () => void;
}

function EmptyState({ onAddAccount }: EmptyStateProps) {
  const { t } = useTranslation('github');

  return (
    <section className="editor-panel p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Github className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('emptyState.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyState.addFirst')}</p>
        </div>
        <Button onClick={onAddAccount}>
          <Plus /> {t('repos.addAccount')}
        </Button>
      </div>
    </section>
  );
}

export default EmptyState;
