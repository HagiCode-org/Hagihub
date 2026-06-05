import { LoaderCircle, Plus, Search, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GitHubWorkflowSummary } from '../../../../shared/api';

interface ActionSearchPanelProps {
  query: string;
  searchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  searchError: string | null;
  scannedRepoCount: number;
  searchResults: GitHubWorkflowSummary[];
  managedKeys: Set<string>;
  persistStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  onQueryChange: (value: string) => void;
  onAdd: (workflow: GitHubWorkflowSummary) => void;
}

function ActionSearchPanel({
  query,
  searchStatus,
  searchError,
  scannedRepoCount,
  searchResults,
  managedKeys,
  persistStatus,
  onQueryChange,
  onAdd,
}: ActionSearchPanelProps) {
  const { t } = useTranslation('github');

  return (
    <section className="editor-panel p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge>{t('actionManagement.search.badge')}</Badge>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('actionManagement.search.title')}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t('actionManagement.search.description')}</p>
        </div>
        <div className="status-chip hidden lg:inline-flex">
          {searchStatus === 'loading'
            ? t('actionManagement.search.scanning')
            : t('actionManagement.search.scannedRepos', { count: scannedRepoCount })}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="sr-only">{t('actionManagement.search.inputLabel')}</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('actionManagement.search.placeholder')}
              className="h-11 pl-10"
            />
          </div>
        </label>

        {searchError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {searchError}
          </div>
        ) : null}

        {query.trim().length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
            {t('actionManagement.search.emptyQuery')}
          </div>
        ) : null}

        {searchStatus === 'loading' ? (
          <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              <span>{t('actionManagement.search.loading')}</span>
            </div>
          </div>
        ) : null}

        {query.trim().length > 0 && searchStatus === 'succeeded' && searchResults.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-5 text-sm leading-6 text-muted-foreground">
            {t('actionManagement.search.noResults')}
          </div>
        ) : null}

        {searchResults.length > 0 ? (
          <div className="space-y-3" style={{ contentVisibility: 'auto' }}>
            {searchResults.map((workflow) => {
              const workflowKey = `${workflow.repoFullName}#${workflow.workflowId}`;
              const isManaged = managedKeys.has(workflowKey);

              return (
                <div key={workflowKey} className="list-row px-4 py-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{workflow.workflowName}</p>
                          <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                            {workflow.supportsDispatch
                              ? t('actionManagement.search.dispatchReady')
                              : t('actionManagement.search.dispatchUnavailable')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Workflow className="size-3.5 shrink-0 text-primary" />
                          <span className="font-mono">{workflow.repoFullName}</span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground/90">{workflow.workflowPath}</p>
                      </div>

                      <Button
                        variant={isManaged ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={isManaged || persistStatus === 'loading'}
                        onClick={() => onAdd(workflow)}
                      >
                        <Plus />
                        {isManaged ? t('actionManagement.search.added') : t('actionManagement.search.add')}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ActionSearchPanel;
