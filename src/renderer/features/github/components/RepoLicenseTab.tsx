import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, PencilLine, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectRepoWorkspaceLicenseState } from '@/store/selectors';
import {
  beginLicenseEditing,
  buildRepoWorkspaceKey,
  cancelLicenseEditing,
  clearLicenseSubmitError,
  fetchRepoLicense,
  setLicenseDraft,
  submitRepoLicense,
} from '@/store/slices/repoWorkspaceSlice';
import { getLicensePreset, LICENSE_PRESETS } from '../license-presets';
import CommitStrategyDialog, { type CommitStrategyDecision } from './CommitStrategyDialog';

interface RepoLicenseTabProps {
  accountId: string | null;
  owner: string;
  repo: string;
  defaultBranch: string;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function buildCommitMessage(action: 'create' | 'update', filename: string): string {
  const verb = action === 'create' ? 'Create' : 'Update';
  return `${verb} ${filename} via Hagihub`;
}

function buildPullRequestTitle(action: 'create' | 'update', filename: string): string {
  const verb = action === 'create' ? 'Create' : 'Update';
  return `${verb} ${filename} via Hagihub`;
}

function resolveSaveError(error: unknown, fallback: string, conflict: string): string {
  if (error instanceof Error) {
    if (error.message.includes('409')) {
      return conflict;
    }

    return error.message;
  }

  return fallback;
}

function RepoLicenseTab({ accountId, owner, repo, defaultBranch }: RepoLicenseTabProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const workspaceKey = buildRepoWorkspaceKey(accountId, owner, repo);
  const licenseState = useAppSelector((state) => selectRepoWorkspaceLicenseState(state, workspaceKey));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const presetOptions = useMemo<SearchableSelectOption[]>(() => (
    LICENSE_PRESETS.map((preset) => ({
      value: preset.id,
      label: t(`repoCard.license.presets.${preset.id}`),
      description: preset.spdxId,
    }))
  ), [t]);

  useEffect(() => {
    if (!accountId) {
      return;
    }

    void dispatch(fetchRepoLicense({ workspaceKey, accountId, owner, repo }));
  }, [accountId, dispatch, owner, repo, workspaceKey]);

  const loadStatus = licenseState?.loadStatus ?? (accountId ? 'loading' : 'idle');
  const error = licenseState?.error ?? null;
  const content = licenseState?.content ?? '';
  const draft = licenseState?.draft ?? '';
  const exists = licenseState?.exists ?? false;
  const isEditing = licenseState?.isEditing ?? false;
  const saveMessage = licenseState?.saveMessage ?? null;
  const submitStatus = licenseState?.submitStatus ?? 'idle';
  const submitError = licenseState?.submitError ?? null;

  const applyTemplate = (template: string) => template
    .replace(/\{year\}/g, String(new Date().getFullYear()))
    .replace(/\{author\}/g, owner);

  const startEditing = () => {
    dispatch(beginLicenseEditing({ workspaceKey, owner, repo }));
  };

  const cancelEditing = () => {
    dispatch(cancelLicenseEditing({ workspaceKey, owner, repo }));
  };

  const handlePresetChange = (presetId: string | null) => {
    setSelectedPreset(presetId);

    if (!presetId) {
      return;
    }

    const preset = getLicensePreset(presetId);
    if (!preset) {
      return;
    }

    dispatch(setLicenseDraft({ workspaceKey, owner, repo, draft: applyTemplate(preset.template) }));
  };

  const confirmSave = async (decision: CommitStrategyDecision) => {
    if (!accountId) {
      return;
    }

    try {
      await dispatch(submitRepoLicense({
        workspaceKey,
        accountId,
        owner,
        repo,
        defaultBranch,
        strategy: decision.strategy,
        branchName: decision.branchName,
      })).unwrap();
      setDialogOpen(false);
    } catch {}
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loadStatus === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t('repoCard.license.loading')}</p>
          </div>
        ) : loadStatus === 'failed' ? (
          <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-5 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                if (!accountId) {
                  return;
                }

                void dispatch(fetchRepoLicense({ workspaceKey, accountId, owner, repo }));
              }}
            >
              {t('repoList.retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing} disabled={submitStatus === 'loading'}>
                    {t('repoCard.license.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      dispatch(clearLicenseSubmitError({ workspaceKey, owner, repo }));
                      setDialogOpen(true);
                    }}
                    disabled={submitStatus === 'loading' || !accountId}
                  >
                    {t('repoCard.license.save')}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startEditing} disabled={loadStatus !== 'succeeded' || !accountId}>
                  <PencilLine className="size-3.5" />
                  {exists ? t('repoCard.license.edit') : t('repoCard.license.create')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/12 p-2 text-primary">
                <Scale className="size-4" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">LICENSE</h3>
                <p className="text-sm text-muted-foreground">{t('repoCard.license.description')}</p>
              </div>
            </div>

            {saveMessage ? (
              <p className={cn('text-sm', saveMessage === t('repoCard.license.saveSuccess') || saveMessage.includes('#') ? 'text-emerald-300' : 'text-destructive')}>
                {saveMessage}
              </p>
            ) : null}

            <div className="rounded-[1.5rem] border border-border/70 bg-background/30 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{t('repoCard.license.presetTitle')}</h4>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('repoCard.license.presetDescription')}</p>
                </div>
                <div className="w-full max-w-sm">
                  <SearchableSelect
                    options={presetOptions}
                    value={selectedPreset}
                    onChange={handlePresetChange}
                    placeholder={t('repoCard.license.presetPlaceholder')}
                    searchPlaceholder={t('repoCard.license.presetSearchPlaceholder')}
                    emptyMessage={t('repoCard.license.presetEmpty')}
                  />
                </div>
              </div>
            </div>

            {isEditing ? (
              <textarea
                className="min-h-[26rem] w-full rounded-[1.5rem] border border-border/70 bg-background/45 px-4 py-4 font-mono text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/20"
                value={draft}
                onChange={(event) => dispatch(setLicenseDraft({ workspaceKey, owner, repo, draft: event.target.value }))}
                placeholder={t('repoCard.license.editorPlaceholder')}
              />
            ) : exists ? (
              <pre className="max-h-[56vh] min-h-[26rem] overflow-auto rounded-[1.5rem] border border-border/70 bg-background/35 px-4 py-4 font-mono text-sm leading-6 whitespace-pre-wrap text-foreground">
                {content}
              </pre>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 px-6 py-12 text-center">
                <PencilLine className="mx-auto size-8 text-primary/80" />
                <h4 className="mt-4 text-lg font-semibold text-foreground">{t('repoCard.license.emptyTitle')}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('repoCard.license.emptyDescription')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <CommitStrategyDialog
        open={dialogOpen}
        filename="LICENSE"
        defaultBranch={defaultBranch}
        submitStatus={submitStatus}
        error={submitError}
        onClose={() => {
          dispatch(clearLicenseSubmitError({ workspaceKey, owner, repo }));
          setDialogOpen(false);
        }}
        onConfirm={(decision) => {
          void confirmSave(decision);
        }}
      />
    </div>
  );
}

export default RepoLicenseTab;
