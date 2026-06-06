import { startTransition, useDeferredValue, useEffect } from 'react';
import { LoaderCircle, Plus, RefreshCw, Settings2, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  addManagedWorkflow,
  clearWorkflowList,
  closeDispatchDialog,
  dispatchManagedWorkflow,
  loadManagedWorkflows,
  loadRepoWorkflows,
  openDispatchDialog,
  refreshManagedWorkflows,
  removeManagedWorkflow,
  resetActionManagement,
  setDispatchInput,
  setSearchQuery,
  setSelectedOwnerKey,
  setSelectedRepoFullName,
} from '@/store/slices/actionManagementSlice';
import { switchAccount } from '@/store/slices/githubAccountsSlice';
import { clearRepos, fetchRepos } from '@/store/slices/githubReposSlice';
import type { GitHubRepo, GitHubWorkflowSummary } from '../../../shared/api';
import ActionSearchPanel from './components/ActionSearchPanel';
import ManagedActionCard from './components/ManagedActionCard';
import WorkflowDispatchDialog from './components/WorkflowDispatchDialog';

interface ActionManagementPageProps {
  onAddAccount: () => void;
  onOpenAccounts: () => void;
}

interface OwnerOption {
  key: string;
  label: string;
  repoCount: number;
}

function filterWorkflows(workflows: GitHubWorkflowSummary[], query: string): GitHubWorkflowSummary[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return workflows;
  }

  return workflows.filter((workflow) =>
    workflow.workflowName.toLowerCase().includes(normalizedQuery)
      || workflow.workflowPath.toLowerCase().includes(normalizedQuery)
      || workflow.repoFullName.toLowerCase().includes(normalizedQuery),
  );
}

function resolveOwnerOptions(personalRepos: GitHubRepo[], groupedRepos: Array<{ org: { login: string }; repos: GitHubRepo[] }>, t: ReturnType<typeof useTranslation>['t']): OwnerOption[] {
  const options: OwnerOption[] = [];

  if (personalRepos.length > 0) {
    options.push({
      key: 'personal',
      label: t('actionManagement.search.personalOwner'),
      repoCount: personalRepos.length,
    });
  }

  for (const group of groupedRepos) {
    options.push({
      key: group.org.login,
      label: group.org.login,
      repoCount: group.repos.length,
    });
  }

  return options;
}

function resolveRepoOptions(selectedOwnerKey: string | null, personalRepos: GitHubRepo[], groupedRepos: Array<{ org: { login: string }; repos: GitHubRepo[] }>): GitHubRepo[] {
  if (selectedOwnerKey === 'personal') {
    return personalRepos;
  }

  if (selectedOwnerKey === null) {
    return [];
  }

  return groupedRepos.find((group) => group.org.login === selectedOwnerKey)?.repos ?? [];
}

function ActionManagementPage({ onAddAccount, onOpenAccounts }: ActionManagementPageProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { accounts, activeAccountId } = useAppSelector((state) => state.githubAccounts);
  const {
    groupedRepos,
    personalRepos,
    activeAccountId: reposAccountId,
    fetchStatus: reposStatus,
    error: reposError,
  } = useAppSelector((state) => state.githubRepos);
  const {
    availableWorkflows,
    dispatchDialog,
    failedRefreshCount,
    loadError,
    loadStatus,
    managedReferences,
    managedWorkflows,
    persistError,
    persistStatus,
    refreshError,
    refreshStatus,
    searchQuery,
    selectedOwnerKey,
    selectedRepoFullName,
    workflowListError,
    workflowListStatus,
  } = useAppSelector((state) => state.actionManagement);
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;
  const deferredQuery = useDeferredValue(searchQuery);
  const referenceSignature = managedReferences.map((workflow) => `${workflow.repoFullName}#${workflow.workflowId}`).join('|');
  const managedKeys = new Set(managedReferences.map((workflow) => `${workflow.repoFullName}#${workflow.workflowId}`));
  const ownerOptions = resolveOwnerOptions(personalRepos, groupedRepos, t);
  const repoOptions = resolveRepoOptions(selectedOwnerKey, personalRepos, groupedRepos);
  const filteredWorkflows = filterWorkflows(availableWorkflows, deferredQuery);

  useEffect(() => {
    if (!activeAccountId) {
      dispatch(resetActionManagement());
      dispatch(clearRepos());
      return;
    }

    void dispatch(loadManagedWorkflows(activeAccountId));
  }, [activeAccountId, dispatch]);

  useEffect(() => {
    if (!activeAccountId) {
      return;
    }

    if (reposAccountId !== activeAccountId || reposStatus === 'idle') {
      void dispatch(fetchRepos(activeAccountId));
    }
  }, [activeAccountId, dispatch, reposAccountId, reposStatus]);

  useEffect(() => {
    if (!activeAccountId || referenceSignature.length === 0) {
      return;
    }

    void dispatch(refreshManagedWorkflows({
      accountId: activeAccountId,
      workflows: managedReferences,
    }));
  }, [activeAccountId, dispatch, managedReferences, referenceSignature]);

  useEffect(() => {
    if (selectedOwnerKey === null) {
      return;
    }

    const ownerExists = ownerOptions.some((owner) => owner.key === selectedOwnerKey);
    if (!ownerExists) {
      dispatch(setSelectedOwnerKey(null));
    }
  }, [dispatch, ownerOptions, selectedOwnerKey]);

  useEffect(() => {
    if (selectedRepoFullName === null) {
      return;
    }

    const repoExists = repoOptions.some((repo) => repo.fullName === selectedRepoFullName);
    if (!repoExists) {
      dispatch(setSelectedRepoFullName(null));
    }
  }, [dispatch, repoOptions, selectedRepoFullName]);

  if (!activeAccountId || !activeAccount) {
    return (
      <div className="space-y-4">
        <section className="editor-panel p-6 lg:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t('actionManagement.badge')}</Badge>
            <Badge variant="outline">{t('actionManagement.noAccountBadge')}</Badge>
          </div>
          <div className="mt-4 max-w-3xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {t('actionManagement.noAccountTitle')}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">{t('actionManagement.noAccountDescription')}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onAddAccount}>
              <Plus />
              {t('actionManagement.addAccount')}
            </Button>
            <Button variant="outline" onClick={onOpenAccounts}>
              <Settings2 />
              {t('actionManagement.openAccounts')}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (loadStatus === 'loading') {
    return (
      <section className="editor-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-medium text-foreground">{t('actionManagement.loading')}</p>
      </section>
    );
  }

  if (loadStatus === 'failed') {
    return (
      <section className="editor-panel border-destructive/30 bg-destructive/6 px-6 py-8">
        <p className="text-base font-semibold text-destructive">{t('actionManagement.loadFailedTitle')}</p>
        <p className="mt-2 text-sm leading-7 text-destructive/90">{loadError}</p>
        <Button className="mt-5" variant="outline" onClick={() => void dispatch(loadManagedWorkflows(activeAccountId))}>
          <RefreshCw />
          {t('actionManagement.retry')}
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t('actionManagement.badge')}</Badge>
              <Badge variant="secondary">@{activeAccount.login}</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {t('actionManagement.title')}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{t('actionManagement.description')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={managedReferences.length === 0 || refreshStatus === 'loading'}
              onClick={() => void dispatch(refreshManagedWorkflows({ accountId: activeAccountId }))}
            >
              <RefreshCw className={refreshStatus === 'loading' ? 'animate-spin' : undefined} />
              {t('actionManagement.refresh')}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="status-chip">{t('actionManagement.managedCount', { count: managedReferences.length })}</span>
          <span>{t('actionManagement.loadedWorkflowCount', { count: availableWorkflows.length })}</span>
          {failedRefreshCount > 0 ? <span>{t('actionManagement.failedRefreshCount', { count: failedRefreshCount })}</span> : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ActionSearchPanel
          accounts={accounts.map((account) => ({ id: account.id, login: account.login }))}
          activeAccountId={activeAccountId}
          ownerOptions={ownerOptions}
          selectedOwnerKey={selectedOwnerKey}
          repoOptions={repoOptions}
          selectedRepoFullName={selectedRepoFullName}
          query={searchQuery}
          workflowListStatus={workflowListStatus}
          workflowListError={workflowListError}
          reposStatus={reposStatus}
          reposError={reposError}
          workflows={filteredWorkflows}
          managedKeys={managedKeys}
          persistStatus={persistStatus}
          onAccountChange={(accountId) => {
            void dispatch(switchAccount(accountId));
          }}
          onOwnerChange={(ownerKey) => {
            startTransition(() => {
              dispatch(setSelectedOwnerKey(ownerKey));
            });
          }}
          onRepoChange={(repoFullName) => {
            startTransition(() => {
              dispatch(setSelectedRepoFullName(repoFullName));
            });
          }}
          onLoadWorkflows={() => {
            if (!selectedRepoFullName) {
              return;
            }

            void dispatch(loadRepoWorkflows({
              accountId: activeAccountId,
              repoFullName: selectedRepoFullName,
            }));
          }}
          onQueryChange={(value) => {
            startTransition(() => {
              dispatch(setSearchQuery(value));
            });
          }}
          onAdd={(workflow) => {
            void dispatch(addManagedWorkflow({
              accountId: activeAccountId,
              workflow,
            }));
          }}
        />

        <section className="editor-panel p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge>{t('actionManagement.managed.badge')}</Badge>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">{t('actionManagement.managed.title')}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{t('actionManagement.managed.description')}</p>
            </div>
            <div className="status-chip">{t('actionManagement.managedCount', { count: managedReferences.length })}</div>
          </div>

          {persistError ? (
            <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {persistError}
            </div>
          ) : null}

          {refreshError ? (
            <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {refreshError}
            </div>
          ) : null}

          {managedReferences.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-border/70 bg-background/25 px-6 py-10 text-center">
              <Workflow className="mx-auto size-8 text-primary" />
              <p className="mt-4 text-base font-medium text-foreground">{t('actionManagement.managed.emptyTitle')}</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('actionManagement.managed.emptyDescription')}</p>
            </div>
          ) : managedWorkflows.length === 0 && refreshStatus === 'loading' ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              {t('actionManagement.managed.refreshing')}
            </div>
          ) : (
            <div className="mt-5 space-y-4" style={{ contentVisibility: 'auto' }}>
              {managedWorkflows.map((workflow) => {
                const workflowKey = `${workflow.repoFullName}#${workflow.workflowId}`;

                return (
                  <ManagedActionCard
                    key={workflowKey}
                    workflow={workflow}
                    removing={persistStatus === 'loading'}
                    onDispatch={(item) => dispatch(openDispatchDialog(item))}
                    onOpenExternal={(url) => {
                      void window.hagihub.openExternal(url);
                    }}
                    onRemove={(item) => {
                      void dispatch(removeManagedWorkflow({
                        accountId: activeAccountId,
                        repoFullName: item.repoFullName,
                        workflowId: item.workflowId,
                      }));
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <WorkflowDispatchDialog
        open={dispatchDialog.open}
        workflow={dispatchDialog.workflow}
        formValues={dispatchDialog.formValues}
        submitStatus={dispatchDialog.submitStatus}
        error={dispatchDialog.error}
        successMessage={dispatchDialog.successMessage}
        onClose={() => dispatch(closeDispatchDialog())}
        onChange={(name, value) => dispatch(setDispatchInput({ name, value }))}
        onSubmit={() => {
          if (!dispatchDialog.workflow) {
            return;
          }

          void dispatch(dispatchManagedWorkflow({
            accountId: activeAccountId,
            workflow: dispatchDialog.workflow,
            inputs: dispatchDialog.formValues,
          })).unwrap().then(() => {
            dispatch(closeDispatchDialog());
            void dispatch(refreshManagedWorkflows({ accountId: activeAccountId }));
          }).catch(() => {});
        }}
      />
    </div>
  );
}

export default ActionManagementPage;
