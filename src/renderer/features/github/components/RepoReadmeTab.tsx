import { useEffect, useState } from 'react';
import { Copy, FileText, Globe2, Languages, LoaderCircle, PencilLine, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReadmeBatchSubmissionResult, ReadmeVariant } from '../../../../shared/api';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import CommitStrategyDialog, { type CommitStrategyDecision } from './CommitStrategyDialog';

interface RepoReadmeTabProps {
  accountId: string | null;
  owner: string;
  repo: string;
  defaultBranch: string;
}

interface ReadmeWorkspaceVariantState extends ReadmeVariant {
  originalContent: string;
  draft: string;
  dirty: boolean;
  sourceVariantPath?: string;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const PRIMARY_README_PATH = 'README.md';
const CANONICAL_ENGLISH_README_PATH = 'README_en-us.md';

const LANGUAGE_OPTIONS: SearchableSelectOption[] = [
  { value: 'zh-cn', label: 'zh-CN', description: 'Chinese (Simplified)' },
  { value: 'ja-jp', label: 'ja-JP', description: 'Japanese' },
  { value: 'ko-kr', label: 'ko-KR', description: 'Korean' },
  { value: 'fr-fr', label: 'fr-FR', description: 'French' },
  { value: 'de-de', label: 'de-DE', description: 'German' },
  { value: 'es-es', label: 'es-ES', description: 'Spanish' },
  { value: 'pt-br', label: 'pt-BR', description: 'Portuguese (Brazil)' },
];

function compareReadmeVariantOrder(left: ReadmeVariant, right: ReadmeVariant): number {
  const rank = (path: string, role: ReadmeVariant['role']): number => {
    if (path === PRIMARY_README_PATH || role === 'primary') {
      return 0;
    }

    if (path === CANONICAL_ENGLISH_README_PATH || role === 'canonical-en') {
      return 1;
    }

    return 2;
  };

  const roleComparison = rank(left.path, left.role) - rank(right.path, right.role);
  if (roleComparison !== 0) {
    return roleComparison;
  }

  const localeComparison = left.locale.localeCompare(right.locale);
  return localeComparison !== 0 ? localeComparison : left.path.localeCompare(right.path);
}

function sortReadmeVariants<T extends ReadmeVariant>(variants: T[]): T[] {
  return [...variants].sort(compareReadmeVariantOrder);
}

function createWorkspaceVariants(variants: ReadmeVariant[]): ReadmeWorkspaceVariantState[] {
  return sortReadmeVariants(variants).map((variant) => ({
    ...variant,
    originalContent: variant.content,
    draft: variant.content,
    dirty: false,
  }));
}

function isEnglishVariant(path: string): boolean {
  return path === PRIMARY_README_PATH || path === CANONICAL_ENGLISH_README_PATH;
}

function updateVariantDraft(
  variants: ReadmeWorkspaceVariantState[],
  path: string,
  draft: string,
  sourceVariantPath?: string,
): ReadmeWorkspaceVariantState[] {
  return variants.map((variant) => {
    if (isEnglishVariant(path) && isEnglishVariant(variant.path)) {
      return {
        ...variant,
        draft,
        dirty: draft !== variant.originalContent,
        sourceVariantPath,
      };
    }

    if (variant.path !== path) {
      return variant;
    }

    return {
      ...variant,
      draft,
      dirty: draft !== variant.originalContent,
      sourceVariantPath,
    };
  });
}

function resetWorkspaceDrafts(variants: ReadmeWorkspaceVariantState[]): ReadmeWorkspaceVariantState[] {
  return variants.map((variant) => ({
    ...variant,
    draft: variant.originalContent,
    dirty: false,
    sourceVariantPath: undefined,
  }));
}

function applyReadmeSubmissionResult(
  variants: ReadmeWorkspaceVariantState[],
  result: ReadmeBatchSubmissionResult,
): ReadmeWorkspaceVariantState[] {
  const writtenByPath = new Map(result.files.filter((file) => file.status === 'written').map((file) => [file.path, file]));

  return variants.map((variant) => {
    const written = writtenByPath.get(variant.path);
    if (!written) {
      return variant;
    }

    return {
      ...variant,
      exists: true,
      sha: written.newSha ?? variant.sha,
      content: written.content,
      originalContent: written.content,
      draft: written.content,
      dirty: false,
      sourceVariantPath: undefined,
    };
  });
}

function createLocalizedReadmePath(locale: string): string {
  return `README_${locale}.md`;
}

function buildReadmeCommitMessage(variants: ReadmeWorkspaceVariantState[]): string {
  return variants.some((variant) => variant.exists)
    ? 'Update README variants via Hagihub'
    : 'Create README variants via Hagihub';
}

function buildReadmePullRequestTitle(variants: ReadmeWorkspaceVariantState[]): string {
  return buildReadmeCommitMessage(variants);
}

function resolveSaveError(
  result: ReadmeBatchSubmissionResult,
  fallback: string,
  fileConflictMessage: (filename: string) => string,
  fileFailureMessage: (filename: string, error: string) => string,
  partialSaveHint: (count: number) => string,
): string {
  const failedFile = result.failedPath ? result.files.find((file) => file.path === result.failedPath) : undefined;

  let message = fallback;
  if (failedFile?.conflict) {
    message = fileConflictMessage(failedFile.path);
  } else if (failedFile) {
    message = fileFailureMessage(failedFile.path, failedFile.error ?? result.error ?? fallback);
  } else if (result.error) {
    message = result.error;
  }

  const writtenCount = result.files.filter((file) => file.status === 'written').length;
  if (result.strategy === 'direct' && writtenCount > 0) {
    return `${message} ${partialSaveHint(writtenCount)}`;
  }

  return message;
}

function RepoReadmeTab({ accountId, owner, repo, defaultBranch }: RepoReadmeTabProps) {
  const { t } = useTranslation('github');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ReadmeWorkspaceVariantState[]>([]);
  const [activePath, setActivePath] = useState(PRIMARY_README_PATH);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading'>('idle');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedCopySource, setSelectedCopySource] = useState<string | null>(null);
  const [showAddLanguagePicker, setShowAddLanguagePicker] = useState(false);

  const loadReadmeWorkspace = async () => {
    if (!accountId) {
      return;
    }

    setLoadState('loading');
    setError(null);

    try {
      const result = await window.hagihub.fetchReadmeWorkspace(accountId, owner, repo);
      const nextWorkspace = createWorkspaceVariants(result.variants);
      setWorkspace(nextWorkspace);
      setActivePath((current) => nextWorkspace.some((variant) => variant.path === current) ? current : PRIMARY_README_PATH);
      setLoadState('loaded');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('repoCard.readme.loadFailed'));
      setLoadState('error');
    }
  };

  useEffect(() => {
    void loadReadmeWorkspace();
  }, [accountId, owner, repo]);

  const activeVariant = workspace.find((variant) => variant.path === activePath) ?? workspace[0] ?? null;
  const modifiedCount = workspace.filter((variant) => variant.dirty).length;
  const addLanguageOptions = LANGUAGE_OPTIONS.filter((option) => !workspace.some((variant) => variant.locale === option.value));
  const copySourceOptions = workspace
    .filter((variant) => variant.path !== activePath)
    .map((variant) => ({
      value: variant.path,
      label: variant.path,
      description: variant.locale.toUpperCase(),
    }));

  const startEditing = () => {
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setWorkspace((current) => resetWorkspaceDrafts(current));
    setIsEditing(false);
    setDialogError(null);
    setSaveMessage(null);
    setSelectedCopySource(null);
    setSelectedLanguage(null);
    setShowAddLanguagePicker(false);
  };

  const handleAddLanguage = (locale: string | null) => {
    setSelectedLanguage(null);
    setShowAddLanguagePicker(false);

    if (!locale) {
      return;
    }

    const path = createLocalizedReadmePath(locale);
    if (workspace.some((variant) => variant.path === path)) {
      setActivePath(path);
      return;
    }

    const nextVariant: ReadmeWorkspaceVariantState = {
      path,
      locale,
      role: 'localized',
      exists: false,
      content: '',
      originalContent: '',
      draft: '',
      sha: '',
      dirty: true,
    };

    setWorkspace((current) => sortReadmeVariants([...current, nextVariant]));
    setActivePath(path);
    setIsEditing(true);
    setSaveMessage(null);
  };

  const handleCopyFromVariant = (sourcePath: string | null) => {
    setSelectedCopySource(null);

    if (!sourcePath || !activeVariant) {
      return;
    }

    const sourceVariant = workspace.find((variant) => variant.path === sourcePath);
    if (!sourceVariant) {
      return;
    }

    setWorkspace((current) => updateVariantDraft(current, activeVariant.path, sourceVariant.draft, sourceVariant.path));
    setIsEditing(true);
    setSaveMessage(null);
  };

  const confirmSave = async (decision: CommitStrategyDecision) => {
    if (!accountId || modifiedCount === 0) {
      return;
    }

    setSubmitStatus('loading');
    setDialogError(null);
    try {

      const result = await window.hagihub.submitReadmeWorkspace(accountId, owner, repo, {
        defaultBranch,
        strategy: decision.strategy,
        branchName: decision.branchName?.trim(),
        commitMessage: buildReadmeCommitMessage(workspace),
        pullRequestTitle: buildReadmePullRequestTitle(workspace),
        variants: workspace.map((variant) => ({
          path: variant.path,
          locale: variant.locale,
          role: variant.role,
          exists: variant.exists,
          sha: variant.sha,
          content: variant.draft,
          originalContent: variant.originalContent,
        })),
      });

      const writtenCount = result.files.filter((file) => file.status === 'written').length;

      if (!result.success) {
        if (result.strategy === 'direct' && writtenCount > 0) {
          setWorkspace((current) => applyReadmeSubmissionResult(current, result));
        }

        setDialogError(resolveSaveError(
          result,
          t('repoCard.readme.saveFailed'),
          (filename) => t('repoCard.readme.conflictFile', { filename }),
          (filename, reason) => t('repoCard.readme.saveFailedFile', { filename, error: reason }),
          (count) => t('repoCard.readme.partialSaveHint', { count }),
        ));
        return;
      }

      if (result.strategy === 'pull_request' && result.pullRequest) {
        await loadReadmeWorkspace();
        setIsEditing(false);
        setDialogOpen(false);
        setSaveMessage(t('repoCard.readme.prSuccessSummary', {
          number: result.pullRequest.number,
          count: writtenCount,
        }));
        return;
      }

      setWorkspace((current) => applyReadmeSubmissionResult(current, result));
      setIsEditing(false);
      setDialogOpen(false);
      setSaveMessage(t('repoCard.readme.saveSuccessSummary', { count: writtenCount }));
    } catch (saveError) {
      setDialogError(saveError instanceof Error ? saveError.message : t('repoCard.readme.saveFailed'));
    } finally {
      setSubmitStatus('idle');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
        {loadState === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t('repoCard.readme.loading')}</p>
          </div>
        ) : loadState === 'error' ? (
          <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-5 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadReadmeWorkspace()}>
              {t('repoList.retry')}
            </Button>
          </div>
        ) : (
          <div className="readme-workspace-frame">
            <div className="readme-workspace">
              <aside className="readme-workspace__sidebar flex min-h-0 flex-col gap-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/25 p-4">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-primary/12 p-2 text-primary">
                      <Languages className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{t('repoCard.readme.workspaceLabel')}</h3>
                      <p className="text-sm text-muted-foreground">{t('repoCard.readme.workspaceDescription')}</p>
                    </div>
                  </div>
                  {saveMessage ? (
                    <p className="mt-3 text-sm text-emerald-300">{saveMessage}</p>
                  ) : null}
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/35 p-4">
                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEditing} disabled={submitStatus === 'loading'}>
                          {t('repoCard.readme.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setDialogError(null);
                            setDialogOpen(true);
                          }}
                          disabled={submitStatus === 'loading' || !accountId || modifiedCount === 0}
                        >
                          {t('repoCard.readme.saveAll')}
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={startEditing} disabled={loadState !== 'loaded' || !accountId}>
                        <PencilLine className="size-3.5" />
                        {t('repoCard.readme.editWorkspace')}
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <Copy className="size-3.5" />
                          {t('repoCard.readme.copyFromTitle')}
                        </div>
                        <SearchableSelect
                          options={copySourceOptions}
                          value={selectedCopySource}
                          onChange={(value) => {
                            setSelectedCopySource(value);
                            handleCopyFromVariant(value);
                          }}
                          placeholder={t('repoCard.readme.copyFromPlaceholder')}
                          searchPlaceholder={t('repoCard.readme.copyFromSearchPlaceholder')}
                          emptyMessage={t('repoCard.readme.copyFromEmpty')}
                          disabled={!activeVariant || copySourceOptions.length === 0}
                        />
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <Plus className="size-3.5" />
                            {t('repoCard.readme.addLanguageTitle')}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => setShowAddLanguagePicker((current) => !current)}
                            disabled={addLanguageOptions.length === 0}
                          >
                            <Plus className="size-3.5" />
                            {t('repoCard.readme.addLanguageTitle')}
                          </Button>
                        </div>
                        {showAddLanguagePicker ? (
                          <SearchableSelect
                            options={addLanguageOptions}
                            value={selectedLanguage}
                            onChange={(value) => {
                              setSelectedLanguage(value);
                              handleAddLanguage(value);
                            }}
                            placeholder={t('repoCard.readme.addLanguagePlaceholder')}
                            searchPlaceholder={t('repoCard.readme.addLanguageSearchPlaceholder')}
                            emptyMessage={t('repoCard.readme.addLanguageEmpty')}
                            disabled={addLanguageOptions.length === 0}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <Globe2 className="size-3.5" />
                    {t('repoCard.readme.languagesTitle')}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t('repoCard.readme.languagesDescription')}</p>

                  <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {workspace.map((variant) => (
                      <button
                        key={variant.path}
                        type="button"
                        onClick={() => setActivePath(variant.path)}
                        className={cn(
                          'w-full rounded-[1.25rem] border px-3 py-3 text-left transition-colors',
                          activeVariant?.path === variant.path
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border/70 bg-background/35 hover:bg-accent/30',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-foreground">{variant.path}</span>
                          {variant.dirty ? <span className="status-chip">{t('repoCard.readme.unsaved')}</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/70 px-2 py-0.5">{variant.locale.toUpperCase()}</span>
                          <span className="rounded-full border border-border/70 px-2 py-0.5">{t(`repoCard.readme.roles.${variant.role}`)}</span>
                          {!variant.exists ? <span className="rounded-full border border-border/70 px-2 py-0.5">{t('repoCard.readme.draftOnly')}</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              {activeVariant ? (
                <div className="readme-workspace__detail rounded-[1.75rem] border border-border/70 bg-background/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-primary/12 p-2 text-primary">
                          <FileText className="size-4" />
                        </span>
                        <div>
                          <h4 className="text-lg font-semibold text-foreground">{activeVariant.path}</h4>
                          <p className="text-sm text-muted-foreground">{t('repoCard.readme.variantDescription', { locale: activeVariant.locale.toUpperCase() })}</p>
                        </div>
                      </div>
                      {activeVariant.sourceVariantPath ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {t('repoCard.readme.copiedFrom', { filename: activeVariant.sourceVariantPath })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/70 px-2 py-1">{t(`repoCard.readme.roles.${activeVariant.role}`)}</span>
                      <span className="rounded-full border border-border/70 px-2 py-1">{activeVariant.locale.toUpperCase()}</span>
                      <span className="rounded-full border border-border/70 px-2 py-1">
                        {activeVariant.exists ? t('repoCard.readme.saved') : t('repoCard.readme.draftOnly')}
                      </span>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="readme-workspace__detail-body">
                      <section className="readme-workspace__panel">
                        <div className="flex items-center justify-between gap-3">
                          <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {t('repoCard.readme.editorTitle')}
                          </h5>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {t('repoCard.readme.editorStats', { count: activeVariant.draft.length })}
                          </span>
                        </div>
                        <textarea
                          className="min-h-[20rem] w-full flex-1 rounded-[1.5rem] border border-border/70 bg-background/45 px-4 py-4 font-mono text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/20 lg:resize-none"
                          value={activeVariant.draft}
                          onChange={(event) => setWorkspace((current) => updateVariantDraft(current, activeVariant.path, event.target.value))}
                          placeholder={t('repoCard.readme.editorPlaceholder')}
                        />
                      </section>

                      <section className="readme-workspace__panel">
                        <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {t('repoCard.readme.previewTitle')}
                        </h5>
                        <MarkdownPreview
                          content={activeVariant.draft}
                          emptyText={t('repoCard.readme.previewEmpty')}
                          className="flex min-h-[20rem] flex-1 flex-col"
                          bodyClassName="min-h-0 flex-1 max-h-none"
                          emptyClassName="min-h-[20rem] flex-1"
                        />
                      </section>
                    </div>
                  ) : activeVariant.exists ? (
                    <MarkdownPreview
                      content={activeVariant.content}
                      emptyText={t('repoCard.readme.previewEmpty')}
                      className="flex min-h-0 flex-1 flex-col"
                      bodyClassName="min-h-0 flex-1 max-h-none"
                      emptyClassName="min-h-[20rem] flex-1"
                    />
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 px-6 py-12 text-center">
                      <PencilLine className="mx-auto size-8 text-primary/80" />
                      <h5 className="mt-4 text-lg font-semibold text-foreground">{t('repoCard.readme.emptyTitle')}</h5>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('repoCard.readme.emptyDescription')}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <CommitStrategyDialog
        open={dialogOpen}
        filename={t('repoCard.readme.workspaceLabel')}
        branchSeed="readme-set"
        scopeNote={t('repoCard.readme.batchScope', { count: modifiedCount })}
        defaultBranch={defaultBranch}
        submitStatus={submitStatus}
        error={dialogError}
        onClose={() => {
          setDialogError(null);
          setDialogOpen(false);
        }}
        onConfirm={(decision) => {
          void confirmSave(decision);
        }}
      />
    </div>
  );
}

export default RepoReadmeTab;
