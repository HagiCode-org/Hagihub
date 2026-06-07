import { LoaderCircle, Plus, RefreshCw, Settings2, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActionManagementPageView, selectActiveGitHubAccount } from '@/store/selectors';
import {
  loadManagedWorkflowsForActiveAccount,
  openTransferModal,
  refreshManagedWorkflowsForActiveAccount,
} from '@/store/slices/actionManagementSlice';
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
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const activeAccount = useAppSelector(selectActiveGitHubAccount);
  const pageView = useAppSelector(selectActionManagementPageView);

  useActionMonitoring();

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

  if (pageView.showLoadingState) {
    return (
      <section className="editor-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-medium text-foreground">{t('actionManagement.loading')}</p>
      </section>
    );
  }

  if (pageView.showLoadFailedState) {
    return (
      <section className="editor-panel border-destructive/30 bg-destructive/6 px-6 py-8">
        <p className="text-base font-semibold text-destructive">{t('actionManagement.loadFailedTitle')}</p>
        <p className="mt-2 text-sm leading-7 text-destructive/90">{pageView.loadError}</p>
        <Button className="mt-5" variant="outline" onClick={() => void dispatch(loadManagedWorkflowsForActiveAccount())}>
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
              disabled={!pageView.canRefreshManagedWorkflows}
              onClick={() => void dispatch(refreshManagedWorkflowsForActiveAccount())}
            >
              <RefreshCw className={pageView.isRefreshingManagedWorkflows ? 'animate-spin' : undefined} />
              {t('actionManagement.refresh')}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="status-chip">{t('actionManagement.managedCount', { count: pageView.managedCount })}</span>
          {pageView.monitoredCount > 0 ? <span className="status-chip">{t('actionManagement.actionMonitoring.monitoredCount', { count: pageView.monitoredCount })}</span> : null}
          {pageView.failedRefreshCount > 0 ? <span>{t('actionManagement.failedRefreshCount', { count: pageView.failedRefreshCount })}</span> : null}
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
            <div className="status-chip">{t('actionManagement.managedCount', { count: pageView.managedCount })}</div>
            {pageView.monitoredCount > 0 ? <div className="status-chip">{t('actionManagement.actionMonitoring.monitoredCount', { count: pageView.monitoredCount })}</div> : null}
          </div>
        </div>

        {pageView.persistError ? (
          <div className="mt-5 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {pageView.persistError}
          </div>
        ) : null}

        {pageView.refreshError ? (
          <div className="mt-5 shrink-0 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {pageView.refreshError}
          </div>
        ) : null}

        {pageView.showManagedEmptyState ? (
          <div className="mt-5 shrink-0 rounded-[1.5rem] border border-dashed border-border/70 bg-background/25 px-6 py-10 text-center">
            <Workflow className="mx-auto size-8 text-primary" />
            <p className="mt-4 text-base font-medium text-foreground">{t('actionManagement.managed.emptyTitle')}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('actionManagement.managed.emptyDescription')}</p>
          </div>
        ) : pageView.showManagedRefreshingState ? (
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
                {pageView.managedWorkflowRows.map(({ key, workflow }) => (
                  <ManagedActionRow key={key} workflow={workflow} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ActionTransferModal />

      <WorkflowDispatchDialog />
    </div>
  );
}

export default ActionManagementPage;
