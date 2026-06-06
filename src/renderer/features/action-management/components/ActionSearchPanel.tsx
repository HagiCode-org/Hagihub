import { LoaderCircle, Plus, RefreshCw, Search, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { GitHubRepo, GitHubWorkflowSummary } from '../../../../shared/api';

interface AccountOption {
  id: string;
  login: string;
}

interface OwnerOption {
  key: string;
  label: string;
  repoCount: number;
}

interface ActionSearchPanelProps {
  accounts: AccountOption[];
  activeAccountId: string;
  ownerOptions: OwnerOption[];
  selectedOwnerKey: string | null;
  repoOptions: GitHubRepo[];
  selectedRepoFullName: string | null;
  query: string;
  workflowListStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  workflowListError: string | null;
  reposStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  reposError: string | null;
  workflows: GitHubWorkflowSummary[];
  managedKeys: Set<string>;
  persistStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  onAccountChange: (accountId: string) => void;
  onOwnerChange: (ownerKey: string | null) => void;
  onRepoChange: (repoFullName: string | null) => void;
  onLoadWorkflows: () => void;
  onQueryChange: (value: string) => void;
  onAdd: (workflow: GitHubWorkflowSummary) => void;
}

function ActionSearchPanel({
  accounts,
  activeAccountId,
  ownerOptions,
  selectedOwnerKey,
  repoOptions,
  selectedRepoFullName,
  query,
  workflowListStatus,
  workflowListError,
  reposStatus,
  reposError,
  workflows,
  managedKeys,
  persistStatus,
  onAccountChange,
  onOwnerChange,
  onRepoChange,
  onLoadWorkflows,
  onQueryChange,
  onAdd,
}: ActionSearchPanelProps) {
  const { t } = useTranslation('github');
  const canLoadWorkflows = selectedRepoFullName !== null && reposStatus === 'succeeded';

  return (
    <section className="editor-panel flex min-h-0 flex-col p-5 lg:p-6">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge>{t('actionManagement.search.badge')}</Badge>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('actionManagement.search.title')}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t('actionManagement.search.description')}</p>
        </div>
        <div className="status-chip hidden lg:inline-flex">
          {workflowListStatus === 'loading'
            ? t('actionManagement.search.loadingList')
            : t('actionManagement.search.loadedCount', { count: workflows.length })}
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.search.accountLabel')}</span>
            <select
              value={activeAccountId}
              className="flex h-10 w-full rounded-lg border border-border/70 bg-background/45 px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
              onChange={(event) => onAccountChange(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>@{account.login}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.search.ownerLabel')}</span>
            <select
              value={selectedOwnerKey ?? ''}
              disabled={reposStatus === 'loading' || ownerOptions.length === 0}
              className="flex h-10 w-full rounded-lg border border-border/70 bg-background/45 px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(event) => onOwnerChange(event.target.value || null)}
            >
              <option value="">{t('actionManagement.search.ownerPlaceholder')}</option>
              {ownerOptions.map((owner) => (
                <option key={owner.key} value={owner.key}>{owner.label} ({owner.repoCount})</option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.search.repoLabel')}</span>
            <SearchableSelect
              options={repoOptions.map((repo) => ({
                value: repo.fullName,
                label: repo.fullName,
              }))}
              value={selectedRepoFullName}
              onChange={onRepoChange}
              placeholder={t('actionManagement.search.repoPlaceholder')}
              searchPlaceholder={t('actionManagement.search.repoSearchPlaceholder')}
              emptyMessage={t('actionManagement.search.noRepoResults')}
              disabled={selectedOwnerKey === null || repoOptions.length === 0}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!canLoadWorkflows || workflowListStatus === 'loading'} onClick={onLoadWorkflows}>
              {workflowListStatus === 'loading' ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              {workflowListStatus === 'succeeded'
                ? t('actionManagement.search.refreshList')
                : t('actionManagement.search.loadList')}
            </Button>
          </div>

          {reposError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {reposError}
            </div>
          ) : null}

          {workflowListError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {workflowListError}
            </div>
          ) : null}

          {selectedOwnerKey === null ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {t('actionManagement.search.chooseOwner')}
            </div>
          ) : null}

          {selectedOwnerKey !== null && selectedRepoFullName === null ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {repoOptions.length > 0 ? t('actionManagement.search.chooseRepo') : t('actionManagement.search.noReposForOwner')}
            </div>
          ) : null}

          {selectedRepoFullName !== null && workflowListStatus === 'idle' ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {t('actionManagement.search.readyToLoad')}
            </div>
          ) : null}

          {workflowListStatus === 'loading' ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                <span>{t('actionManagement.search.loading')}</span>
              </div>
            </div>
          ) : null}

          {workflowListStatus === 'succeeded' ? (
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
          ) : null}
        </div>

        {workflowListStatus === 'succeeded' && workflows.length === 0 ? (
          <div className="shrink-0 rounded-2xl border border-border/70 bg-background/35 px-4 py-5 text-sm leading-6 text-muted-foreground">
            {t('actionManagement.search.noResults')}
          </div>
        ) : null}

        {workflowListStatus === 'succeeded' && workflows.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {workflows.map((workflow) => {
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
