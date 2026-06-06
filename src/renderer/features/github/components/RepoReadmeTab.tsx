import { useEffect, useState } from 'react';
import { FileText, LoaderCircle, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CommitStrategyDialog, { type CommitStrategyDecision } from './CommitStrategyDialog';

interface RepoReadmeTabProps {
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

function RepoReadmeTab({ accountId, owner, repo, defaultBranch }: RepoReadmeTabProps) {
  const { t } = useTranslation('github');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState('');
  const [sha, setSha] = useState('');
  const [exists, setExists] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading'>('idle');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadReadme = async () => {
    if (!accountId) {
      return;
    }

    setLoadState('loading');
    setError(null);

    try {
      const result = await window.hagihub.fetchFileContent(accountId, owner, repo, 'README.md');
      setContent(result.content);
      setDraft(result.content);
      setSha(result.sha);
      setExists(result.exists);
      setLoadState('loaded');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('repoCard.readme.loadFailed'));
      setLoadState('error');
    }
  };

  useEffect(() => {
    void loadReadme();
  }, [accountId, owner, repo]);

  const startEditing = () => {
    setDraft(content);
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setDraft(content);
    setIsEditing(false);
    setDialogError(null);
    setSaveMessage(null);
  };

  const confirmSave = async (decision: CommitStrategyDecision) => {
    if (!accountId) {
      return;
    }

    setSubmitStatus('loading');
    setDialogError(null);

    const action = exists ? 'update' : 'create';

    try {
      if (decision.strategy === 'pull_request') {
        const branchName = decision.branchName?.trim() ?? '';

        await window.hagihub.createRef(accountId, owner, repo, {
          ref: branchName,
          sha: defaultBranch,
        });

        const commitResult = await window.hagihub.commitFile(accountId, owner, repo, 'README.md', {
          content: draft,
          message: buildCommitMessage(action, 'README.md'),
          branch: branchName,
          sha,
        });

        const pullRequest = await window.hagihub.createPullRequest(accountId, owner, repo, {
          title: buildPullRequestTitle(action, 'README.md'),
          head: branchName,
          base: defaultBranch,
        });

        setContent(draft);
        setSha(commitResult.newSha);
        setExists(true);
        setIsEditing(false);
        setDialogOpen(false);
        setSaveMessage(t('repoCard.readme.prSuccess', { number: pullRequest.number }));
      } else {
        const commitResult = await window.hagihub.commitFile(accountId, owner, repo, 'README.md', {
          content: draft,
          message: buildCommitMessage(action, 'README.md'),
          branch: defaultBranch,
          sha,
        });

        setContent(draft);
        setSha(commitResult.newSha);
        setExists(true);
        setIsEditing(false);
        setDialogOpen(false);
        setSaveMessage(t('repoCard.readme.saveSuccess'));
      }
    } catch (saveError) {
      setDialogError(resolveSaveError(saveError, t('repoCard.readme.saveFailed'), t('repoCard.readme.conflict')));
      return;
    } finally {
      setSubmitStatus('idle');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loadState === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t('repoCard.readme.loading')}</p>
          </div>
        ) : loadState === 'error' ? (
          <div className="rounded-[1.5rem] border border-destructive/30 bg-destructive/8 px-5 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadReadme()}>
              {t('repoList.retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/12 p-2 text-primary">
                <FileText className="size-4" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">README.md</h3>
                <p className="text-sm text-muted-foreground">{t('repoCard.readme.description')}</p>
              </div>
            </div>

            {saveMessage ? (
              <p className={cn('text-sm', saveMessage === t('repoCard.readme.saveSuccess') || saveMessage.includes('#') ? 'text-emerald-300' : 'text-destructive')}>
                {saveMessage}
              </p>
            ) : null}

            {isEditing ? (
              <textarea
                className="min-h-[26rem] w-full rounded-[1.5rem] border border-border/70 bg-background/45 px-4 py-4 font-mono text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/20"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('repoCard.readme.editorPlaceholder')}
              />
            ) : exists ? (
              <pre className="max-h-[56vh] min-h-[26rem] overflow-auto rounded-[1.5rem] border border-border/70 bg-background/35 px-4 py-4 font-mono text-sm leading-6 whitespace-pre-wrap text-foreground">
                {content}
              </pre>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/20 px-6 py-12 text-center">
                <PencilLine className="mx-auto size-8 text-primary/80" />
                <h4 className="mt-4 text-lg font-semibold text-foreground">{t('repoCard.readme.emptyTitle')}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('repoCard.readme.emptyDescription')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-6 py-4">
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
              disabled={submitStatus === 'loading' || !accountId}
            >
              {t('repoCard.readme.save')}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={startEditing} disabled={loadState !== 'loaded' || !accountId}>
            <PencilLine className="size-3.5" />
            {exists ? t('repoCard.readme.edit') : t('repoCard.readme.create')}
          </Button>
        )}
      </div>

      <CommitStrategyDialog
        open={dialogOpen}
        filename="README.md"
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
