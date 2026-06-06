import { useEffect, useRef } from 'react';
import { LoaderCircle, Plus, RefreshCw, Settings2, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  closeDispatchDialog,
  closeTransferModal,
  dispatchManagedWorkflow,
  loadManagedWorkflows,
  openDispatchDialog,
  openTransferModal,
  refreshManagedWorkflows,
  removeManagedWorkflow,
  resetActionManagement,
  setDispatchInput,
  toggleMonitoring,
} from '@/store/slices/actionManagementSlice';
import { clearRepos, fetchRepos } from '@/store/slices/githubReposSlice';
import { setActiveSection } from '@/store/slices/navigationSlice';
import ManagedActionRow from './components/ManagedActionRow';
import ActionTransferModal from './components/ActionTransferModal';
import useActionMonitoring from './hooks/useActionMonitoring';
import WorkflowDispatchDialog from './components/WorkflowDispatchDialog';

interface ActionManagementPageProps {
  onAddAccount: () => void;
  onOpenAccounts: () => void;
}

function ActionManagementPage({ onAddAccount, onOpenAccounts }: ActionManagementPageProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const previousLoadStatusRef = useRef<'idle' | 'loading' | 'succeeded' | 'failed'>('idle');
  const { accounts, activeAccountId } = useAppSelector((state) => state.githubAccounts);
  const {
    groupedRepos,
    personalRepos,
    activeAccountId: reposAccountId,
    fetchStatus: reposStatus,
    error: reposError,
  } = useAppSelector((state) => state.githubRepos);
  const {
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
    transferModal,
  } = useAppSelector((state) => state.actionManagement);
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;
  const monitoredCount = managedReferences.filter((workflow) => workflow.monitored === true).length;

  useActionMonitoring(activeAccountId);

  useEffect(() => {
    if (!activeAccountId) {
      dispatch(resetActionManagement());
      dispatch(clearRepos());
      previousLoadStatusRef.current = 'idle';
      return;
    }

    void dispatch(loadManagedWorkflows(activeAccountId));
  }, [activeAccountId, dispatch]);

  useEffect(() => {
    if (!activeAccountId) {
      return;
    }

    if (reposAccountId !== activeAccountId || reposStatus === 'idle') {
      void dispatch(fetchRepos({ accountId: activeAccountId }));
    }
  }, [activeAccountId, dispatch, reposAccountId, reposStatus]);

  useEffect(() => {
    const previousLoadStatus = previousLoadStatusRef.current;
    previousLoadStatusRef.current = loadStatus;

    if (!activeAccountId || loadStatus !== 'succeeded' || previousLoadStatus === 'succeeded' || managedReferences.length === 0) {
      return;
    }

    void dispatch(refreshManagedWorkflows({
      accountId: activeAccountId,
      workflows: managedReferences,
    }));
  }, [activeAccountId, dispatch, loadStatus, managedReferences]);

  useEffect(() => {
    const handleNavigateToSection = (event: WindowEventMap['hagihub:navigate-to-section']) => {
      if (event.detail === 'actions') {
        dispatch(setActiveSection('actions'));
      }
    };

    window.addEventListener('hagihub:navigate-to-section', handleNavigateToSection);
    return () => {
      window.removeEventListener('hagihub:navigate-to-section', handleNavigateToSection);
    };
  }, [dispatch]);

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
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <section className="editor-panel shrink-0 p-5 lg:p-6">
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
            <Button size="sm" onClick={() => dispatch(openTransferModal())}>
              <Workflow />
              {t('actionManagement.transfer.configure')}
            </Button>
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
          {monitoredCount > 0 ? <span className="status-chip">{t('actionManagement.actionMonitoring.monitoredCount', { count: monitoredCount })}</span> : null}
          {failedRefreshCount > 0 ? <span>{t('actionManagement.failedRefreshCount', { count: failedRefreshCount })}</span> : null}
        </div>
      </section>

      <section className="editor-panel flex min-h-0 flex-1 flex-col p-5 lg:p-6">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Badge>{t('actionManagement.managed.badge')}</Badge>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">{t('actionManagement.managed.title')}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{t('actionManagement.managed.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="status-chip">{t('actionManagement.managedCount', { count: managedReferences.length })}</div>
            {monitoredCount > 0 ? <div className="status-chip">{t('actionManagement.actionMonitoring.monitoredCount', { count: monitoredCount })}</div> : null}
          </div>
        </div>

        {persistError ? (
          <div className="mt-5 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {persistError}
          </div>
        ) : null}

        {refreshError ? (
          <div className="mt-5 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {refreshError}
          </div>
        ) : null}

        {managedReferences.length === 0 ? (
          <div className="mt-5 shrink-0 rounded-[1.5rem] border border-dashed border-border/70 bg-background/25 px-6 py-10 text-center">
            <Workflow className="mx-auto size-8 text-primary" />
            <p className="mt-4 text-base font-medium text-foreground">{t('actionManagement.managed.emptyTitle')}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('actionManagement.managed.emptyDescription')}</p>
          </div>
        ) : managedWorkflows.length === 0 && refreshStatus === 'loading' ? (
          <div className="mt-5 flex shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/35 px-4 py-5 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            {t('actionManagement.managed.refreshing')}
          </div>
        ) : (
          <div className="mt-5 min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{t('actionManagement.table.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('actionManagement.table.workflow')}</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('actionManagement.table.path')}</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">{t('actionManagement.table.latestRun')}</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">{t('actionManagement.table.updated')}</th>
                  <th className="px-4 py-3 font-medium">{t('actionManagement.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {managedWorkflows.map((workflow) => {
                  const workflowKey = `${workflow.repoFullName}#${workflow.workflowId}`;

                  return (
                    <ManagedActionRow
                      key={workflowKey}
                      workflow={workflow}
                      removing={persistStatus === 'loading'}
                      onDispatch={(item) => dispatch(openDispatchDialog(item))}
                      onToggleMonitoring={(item) => {
                        void dispatch(toggleMonitoring({
                          accountId: activeAccountId,
                          repoFullName: item.repoFullName,
                          workflowId: item.workflowId,
                        }));
                      }}
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
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ActionTransferModal
        open={transferModal.open}
        accountId={activeAccountId}
        personalRepos={personalRepos}
        groupedRepos={groupedRepos}
        reposStatus={reposStatus}
        reposError={reposError}
        onClose={() => dispatch(closeTransferModal())}
        onSaved={() => {
          void dispatch(refreshManagedWorkflows({ accountId: activeAccountId }));
        }}
      />

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
