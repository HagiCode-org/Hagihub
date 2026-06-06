import { useEffect, useEffectEvent } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  batchSaveManagedWorkflows,
  clearTransferLoadErrors,
  loadMultiRepoWorkflows,
  moveToStaged,
  removeFromStaged,
  setTransferPhase,
  toggleRepoSelection,
} from '@/store/slices/actionManagementSlice';
import type { GitHubRepo } from '../../../../shared/api';
import type { GitHubRepoGroup } from '@/store/slices/githubReposSlice';
import RepoMultiSelect, { type RepoOwnerOption } from './RepoMultiSelect';
import WorkflowTransferBox from './WorkflowTransferBox';

interface ActionTransferModalProps {
  open: boolean;
  accountId: string;
  personalRepos: GitHubRepo[];
  groupedRepos: GitHubRepoGroup[];
  reposStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  reposError: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActionTransferModal({
  open,
  accountId,
  personalRepos,
  groupedRepos,
  reposStatus,
  reposError,
  onClose,
  onSaved,
}: ActionTransferModalProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const {
    candidateWorkflows,
    loadErrors,
    loadProgress,
    phase,
    saveError,
    saveStatus,
    selectedRepoFullNames,
    stagedSelection,
  } = useAppSelector((state) => state.actionManagement.transferModal);

  const ownerOptions: RepoOwnerOption[] = [
    ...(personalRepos.length > 0
      ? [{
        key: 'personal',
        label: t('actionManagement.transfer.personalOwner'),
        repoCount: personalRepos.length,
      }]
      : []),
    ...groupedRepos.map((group) => ({
      key: group.org.login,
      label: group.org.login,
      repoCount: group.repos.length,
    })),
  ];
  const isLoadingWorkflows = loadProgress.total > 0 && loadProgress.current < loadProgress.total;
  const canLoadWorkflows = selectedRepoFullNames.length > 0 && reposStatus === 'succeeded' && !isLoadingWorkflows;
  const canClose = saveStatus !== 'loading';
  const phases = [
    t('actionManagement.transfer.phaseRepos'),
    t('actionManagement.transfer.phaseTransfer'),
    t('actionManagement.transfer.phaseConfirm'),
  ] as const;
  const loadErrorEntries = Object.entries(loadErrors);

  const requestClose = useEffectEvent(() => {
    if (!canClose) {
      return;
    }

    onClose();
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
    dispatch(clearTransferLoadErrors());

    try {
      await dispatch(loadMultiRepoWorkflows({ accountId })).unwrap();
      dispatch(setTransferPhase(2));
    } catch {
      // Per-repo failures are accumulated in Redux state and displayed inline.
    }
  };

  const handleSave = async () => {
    try {
      await dispatch(batchSaveManagedWorkflows({
        accountId,
        stagedSelection,
      })).unwrap();
      onClose();
      onSaved();
    } catch {
      // The slice stores the failure state and keeps the modal open.
    }
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
      <div className="w-full max-w-6xl rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('actionManagement.transfer.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('actionManagement.transfer.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} disabled={!canClose} aria-label={t('actionManagement.transfer.cancel')}>
            <X />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
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
              <RepoMultiSelect
                ownerOptions={ownerOptions}
                personalRepos={personalRepos}
                groupedRepos={groupedRepos}
                selectedRepoFullNames={selectedRepoFullNames}
                onToggleRepo={(repoFullName) => dispatch(toggleRepoSelection(repoFullName))}
                reposStatus={reposStatus}
              />

              {reposError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {reposError}
                </div>
              ) : null}

              {isLoadingWorkflows ? (
                <div className="panel-muted flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                  {t('actionManagement.transfer.loadingProgress', {
                    current: loadProgress.current,
                    total: loadProgress.total,
                  })}
                </div>
              ) : null}

              {loadErrorEntries.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-4 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    {t('actionManagement.transfer.loadErrorsTitle')}
                  </div>
                  <div className="space-y-2">
                    {loadErrorEntries.map(([repoFullName, message]) => (
                      <p key={repoFullName}>
                        <span className="font-mono">{repoFullName}</span>
                        {`: ${message}`}
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
                  {isLoadingWorkflows ? <LoaderCircle className="animate-spin" /> : null}
                  {t('actionManagement.transfer.loadWorkflows')}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 2 ? (
            <div className="space-y-5">
              <WorkflowTransferBox
                availableWorkflows={candidateWorkflows}
                stagedWorkflows={stagedSelection}
                onMoveToStaged={(workflows) => dispatch(moveToStaged(workflows))}
                onRemoveFromStaged={(workflows) => dispatch(removeFromStaged(workflows))}
              />

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => dispatch(setTransferPhase(1))}>
                  {t('actionManagement.transfer.back')}
                </Button>
                <Button onClick={() => dispatch(setTransferPhase(3))}>{t('actionManagement.transfer.save')}</Button>
              </div>
            </div>
          ) : null}

          {phase === 3 ? (
            <div className="space-y-5">
              <section className="editor-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge>{t('actionManagement.transfer.phaseConfirm')}</Badge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {t('actionManagement.transfer.confirmDescription', { count: stagedSelection.length })}
                    </p>
                  </div>
                  <div className="status-chip">{t('actionManagement.transfer.selected', { count: stagedSelection.length })}</div>
                </div>

                <div className="mt-5 max-h-[22rem] space-y-2 overflow-y-auto">
                  {stagedSelection.length === 0 ? (
                    <div className="panel-muted px-4 py-6 text-sm leading-6 text-muted-foreground">
                      {t('actionManagement.transfer.emptySelected')}
                    </div>
                  ) : (
                    stagedSelection.map((workflow) => (
                      <div key={`${workflow.repoFullName}#${workflow.workflowId}`} className="list-row px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{workflow.workflowName}</p>
                          <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                            {workflow.supportsDispatch
                              ? t('actionManagement.card.dispatchReady')
                              : t('actionManagement.card.dispatchUnavailable')}
                          </Badge>
                        </div>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">{workflow.repoFullName}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground/90">{workflow.workflowPath}</p>
                      </div>
                    ))
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
