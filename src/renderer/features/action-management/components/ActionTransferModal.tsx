import { useEffect, useEffectEvent } from 'react';
import { AlertCircle, Eye, LoaderCircle, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GLOBAL_TRANSFER_LOAD_ERROR_KEY } from '@/features/action-management/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActionTransferModalView, selectActionTransferWorkflowSelectionView } from '@/store/selectors';
import {
  batchSaveManagedWorkflows,
  closeTransferModal,
  clearTransferLoadErrors,
  loadMultiRepoWorkflows,
  setTransferPhase,
} from '@/store/slices/actionManagementSlice';
import RepoMultiSelect from './RepoMultiSelect';
import WorkflowTransferBox from './WorkflowTransferBox';

function ActionTransferModal() {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const { fetchStatus: reposStatus, error: reposError } = useAppSelector((state) => state.githubRepos);
  const {
    loadProgress,
    open,
    phase,
    saveError,
    saveStatus,
    stagedSelection,
  } = useAppSelector((state) => state.actionManagement.transferModal);
  const transferModalView = useAppSelector(selectActionTransferModalView);
  const { recommendationLookup } = useAppSelector(selectActionTransferWorkflowSelectionView);

  const canLoadWorkflows = transferModalView.selectedRepoCount > 0 && reposStatus === 'succeeded' && !transferModalView.isLoadingWorkflows;
  const canClose = transferModalView.canClose;
  const phases = [
    t('actionManagement.transfer.phaseRepos'),
    t('actionManagement.transfer.phaseTransfer'),
    t('actionManagement.transfer.phaseConfirm'),
  ] as const;

  const requestClose = useEffectEvent(() => {
    if (!canClose) {
      return;
    }

    dispatch(closeTransferModal());
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, requestClose]);

  if (!open) {
    return null;
  }

  const handleLoadWorkflows = async () => {
    if (!activeAccountId) {
      return;
    }

    dispatch(clearTransferLoadErrors());

    try {
      await dispatch(loadMultiRepoWorkflows({ accountId: activeAccountId })).unwrap();
      dispatch(setTransferPhase(2));
    } catch {
      // Per-repo failures are accumulated in Redux state and displayed inline.
    }
  };

  const handleSave = async () => {
    if (!activeAccountId) {
      return;
    }

    try {
      await dispatch(batchSaveManagedWorkflows({
        accountId: activeAccountId,
        stagedSelection,
      })).unwrap();
    } catch {
      // The slice stores the failure state and keeps the modal open.
    }
  };

  const renderRecommendationBadges = (recommendations: Array<{ type: 'watch' | 'include'; reason?: string }>) => {
    if (recommendations.length === 0) {
      return <span className="text-xs text-muted-foreground">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {recommendations.map((recommendation, index) => (
          <Badge
            key={`${recommendation.type}-${recommendation.reason ?? 'plain'}-${index}`}
            variant={recommendation.type === 'watch' ? 'secondary' : 'outline'}
            title={recommendation.reason}
            className="gap-1"
          >
            {recommendation.type === 'watch'
              ? <Eye className="size-3.5" />
              : <Star className="size-3.5" />}
            {recommendation.type === 'watch'
              ? t('actionManagement.recommendation.watch')
              : t('actionManagement.recommendation.include')}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,18,0.8)] px-4 py-6 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('actionManagement.transfer.title')}
    >
      <div className="flex h-[80vh] w-[80vw] max-w-none flex-col overflow-hidden rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('actionManagement.transfer.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('actionManagement.transfer.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} disabled={!canClose} aria-label={t('actionManagement.transfer.cancel')}>
            <X />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            {phases.map((label, index) => {
              const phaseNumber = (index + 1) as 1 | 2 | 3;
              const isActive = phase === phaseNumber;
              const isComplete = phase > phaseNumber;

              return (
                <div
                  key={label}
                  className={`rounded-[1.5rem] border px-4 py-3 transition-colors ${
                    isActive
                      ? 'border-primary/40 bg-primary/12 text-primary'
                      : isComplete
                        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                        : 'border-border/70 bg-background/30 text-muted-foreground'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.18em]">{phaseNumber}</p>
                  <p className="mt-2 text-sm font-medium">{label}</p>
                </div>
              );
            })}
          </div>

          {phase === 1 ? (
            <div className="space-y-5">
              <RepoMultiSelect reposStatus={reposStatus} />

              {reposError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {reposError}
                </div>
              ) : null}

              {transferModalView.isLoadingWorkflows ? (
                <div className="panel-muted flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                  {t('actionManagement.transfer.loadingProgress', {
                    current: loadProgress.current,
                    total: loadProgress.total,
                  })}
                </div>
              ) : null}

              {transferModalView.loadErrorEntries.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-4 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    {t('actionManagement.transfer.loadErrorsTitle')}
                  </div>
                  <div className="space-y-2">
                    {transferModalView.loadErrorEntries.map(([repoFullName, message]) => (
                      <p key={repoFullName}>
                        {repoFullName === GLOBAL_TRANSFER_LOAD_ERROR_KEY ? (
                          message
                        ) : (
                          <>
                            <span className="font-mono">{repoFullName}</span>
                            {`: ${message}`}
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={requestClose} disabled={!canClose}>
                  {t('actionManagement.transfer.cancel')}
                </Button>
                <Button onClick={() => void handleLoadWorkflows()} disabled={!canLoadWorkflows}>
                  {transferModalView.isLoadingWorkflows ? <LoaderCircle className="animate-spin" /> : null}
                  {t('actionManagement.transfer.loadWorkflows')}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 2 ? (
            <div className="space-y-5">
              <WorkflowTransferBox />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => dispatch(setTransferPhase(1))}>
                  {t('actionManagement.transfer.back')}
                </Button>
                <Button onClick={() => dispatch(setTransferPhase(3))}>{t('actionManagement.transfer.save')}</Button>
              </div>
            </div>
          ) : null}

          {phase === 3 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5">
              <section className="editor-panel flex min-h-0 flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge>{t('actionManagement.transfer.phaseConfirm')}</Badge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {t('actionManagement.transfer.confirmDescription', { count: stagedSelection.length })}
                    </p>
                  </div>
                  <div className="status-chip">{t('actionManagement.transfer.selected', { count: stagedSelection.length })}</div>
                </div>

                <div className="mt-5 min-h-0 flex-1 overflow-auto">
                  {stagedSelection.length === 0 ? (
                    <div className="panel-muted px-4 py-6 text-sm leading-6 text-muted-foreground">
                      {t('actionManagement.transfer.emptySelected')}
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                        <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          <th className="px-3 py-3 font-medium">{t('actionManagement.table.workflow')}</th>
                          <th className="px-3 py-3 font-medium">{t('actionManagement.table.recommendation')}</th>
                          <th className="px-3 py-3 font-medium">{t('repoList.columns.repository')}</th>
                          <th className="hidden px-3 py-3 font-medium xl:table-cell">{t('actionManagement.table.path')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagedSelection.map((workflow) => {
                          const key = `${workflow.repoFullName}#${workflow.workflowId}`;
                          const recommendations = recommendationLookup[key] ?? [];

                          return (
                            <tr key={key} className="border-b border-border/60">
                              <td className="px-3 py-3 align-top text-sm font-medium text-foreground">{workflow.workflowName}</td>
                              <td className="px-3 py-3 align-top">{renderRecommendationBadges(recommendations)}</td>
                              <td className="px-3 py-3 align-top font-mono text-xs text-muted-foreground">{workflow.repoFullName}</td>
                              <td className="hidden px-3 py-3 align-top font-mono text-xs text-muted-foreground/90 xl:table-cell">{workflow.workflowPath}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {saveError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {saveError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => dispatch(setTransferPhase(2))} disabled={saveStatus === 'loading'}>
                  {t('actionManagement.transfer.back')}
                </Button>
                <Button variant="outline" onClick={requestClose} disabled={!canClose}>
                  {t('actionManagement.transfer.cancel')}
                </Button>
                <Button onClick={() => void handleSave()} disabled={saveStatus === 'loading'}>
                  {saveStatus === 'loading' ? <LoaderCircle className="animate-spin" /> : null}
                  {saveStatus === 'loading'
                    ? t('actionManagement.transfer.saving')
                    : t('actionManagement.transfer.save')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ActionTransferModal;
