import { useEffect, useState } from 'react';
import { GitBranchPlus, GitCommitHorizontal, GitPullRequest, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type CommitStrategy = 'direct' | 'pull_request';

export interface CommitStrategyDecision {
  strategy: CommitStrategy;
  branchName?: string;
}

interface CommitStrategyDialogProps {
  open: boolean;
  filename: string;
  branchSeed?: string;
  scopeNote?: string;
  defaultBranch: string;
  submitStatus: 'idle' | 'loading';
  error: string | null;
  onClose: () => void;
  onConfirm: (decision: CommitStrategyDecision) => void;
}

function slugifyFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/u, '');
  const slug = withoutExtension.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  return slug.length > 0 ? slug : 'file';
}

export function createSuggestedBranchName(filename: string, now = new Date()): string {
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `hagihub/update-${slugifyFilename(filename)}-${timestamp}-${suffix}`;
}

function CommitStrategyDialog({
  open,
  filename,
  branchSeed,
  scopeNote,
  defaultBranch,
  submitStatus,
  error,
  onClose,
  onConfirm,
}: CommitStrategyDialogProps) {
  const { t } = useTranslation('github');
  const [strategy, setStrategy] = useState<CommitStrategy>('direct');
  const branchTarget = branchSeed ?? filename;
  const [branchName, setBranchName] = useState(() => createSuggestedBranchName(branchTarget));

  useEffect(() => {
    if (!open) {
      return;
    }

    setStrategy('direct');
    setBranchName(createSuggestedBranchName(branchTarget));
  }, [branchTarget, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && submitStatus !== 'loading') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open, submitStatus]);

  if (!open) {
    return null;
  }

  const isSubmitting = submitStatus === 'loading';
  const confirmDisabled = isSubmitting || (strategy === 'pull_request' && branchName.trim().length === 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(6,10,18,0.8)] px-4 py-6 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('repoCard.commitDialog.title', { filename })}
    >
      <div className="w-full max-w-2xl rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('repoCard.commitDialog.title', { filename })}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('repoCard.commitDialog.description')}</p>
            {scopeNote ? <p className="mt-2 text-sm text-muted-foreground">{scopeNote}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting} aria-label={t('repoCard.commitDialog.close')}>
            <X />
          </Button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <button
            type="button"
            className={cn(
              'w-full rounded-[1.5rem] border px-5 py-4 text-left transition-colors',
              strategy === 'direct'
                ? 'border-primary/40 bg-primary/10'
                : 'border-border/70 bg-background/35 hover:bg-accent/30',
            )}
            onClick={() => setStrategy('direct')}
          >
            <div className="flex items-start gap-4">
              <div className={cn('mt-0.5 rounded-xl p-2', strategy === 'direct' ? 'bg-primary/20 text-primary' : 'bg-background/55 text-muted-foreground')}>
                <GitCommitHorizontal className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{t('repoCard.commitDialog.directTitle', { branch: defaultBranch })}</span>
                  {strategy === 'direct' ? <span className="status-chip">{t('repoCard.commitDialog.selected')}</span> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('repoCard.commitDialog.directDescription')}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className={cn(
              'w-full rounded-[1.5rem] border px-5 py-4 text-left transition-colors',
              strategy === 'pull_request'
                ? 'border-primary/40 bg-primary/10'
                : 'border-border/70 bg-background/35 hover:bg-accent/30',
            )}
            onClick={() => setStrategy('pull_request')}
          >
            <div className="flex items-start gap-4">
              <div className={cn('mt-0.5 rounded-xl p-2', strategy === 'pull_request' ? 'bg-primary/20 text-primary' : 'bg-background/55 text-muted-foreground')}>
                <GitPullRequest className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{t('repoCard.commitDialog.prTitle')}</span>
                  {strategy === 'pull_request' ? <span className="status-chip">{t('repoCard.commitDialog.selected')}</span> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('repoCard.commitDialog.prDescription', { branch: defaultBranch })}</p>
              </div>
            </div>
          </button>

          {strategy === 'pull_request' ? (
            <div className="rounded-[1.5rem] border border-border/70 bg-background/35 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GitBranchPlus className="size-4 text-primary" />
                {t('repoCard.commitDialog.branchLabel')}
              </div>
              <Input
                className="mt-3 h-10"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder={t('repoCard.commitDialog.branchPlaceholder')}
                disabled={isSubmitting}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('repoCard.commitDialog.branchHint')}</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('repoCard.commitDialog.cancel')}
            </Button>
            <Button
              onClick={() => onConfirm(strategy === 'pull_request' ? { strategy, branchName: branchName.trim() } : { strategy })}
              disabled={confirmDisabled}
            >
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
              {isSubmitting
                ? t('repoCard.commitDialog.submitting')
                : strategy === 'direct'
                  ? t('repoCard.commitDialog.confirmDirect')
                  : t('repoCard.commitDialog.confirmPr')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommitStrategyDialog;
