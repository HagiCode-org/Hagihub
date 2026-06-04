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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px] xl:items-start">
        <div className="space-y-5">
          <span className="flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Github className="size-6" />
          </span>
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('emptyState.title')}</h3>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t('emptyState.description')}</p>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{t('emptyState.secondary')}</p>
          </div>
          <Button size="lg" onClick={onAddAccount}>
            <Plus /> {t('workspace.addAccount')}
          </Button>
        </div>

        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('emptyState.tipTitle')}</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="list-row px-3 py-3">{t('emptyState.tip1')}</div>
            <div className="list-row px-3 py-3">{t('emptyState.tip2')}</div>
            <div className="list-row px-3 py-3">{t('emptyState.tip3')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EmptyState;
