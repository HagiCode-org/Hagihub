import { ArrowUpRight, CheckCircle2, GitFork, LoaderCircle, LockKeyhole, Radio, TriangleAlert, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store';
import type { GitHubActionRunState, GitHubRepo } from '../../../../shared/api';

interface RepoCardProps {
  repo: GitHubRepo;
}

type RepoActionDisplayState = GitHubActionRunState | 'loading';

function RepoCard({ repo }: RepoCardProps) {
  const { t, i18n } = useTranslation('github');
  const summary = useAppSelector((state) => state.githubActions.summariesByRepoFullName[repo.fullName]);
  const actionsFetchStatus = useAppSelector((state) => state.githubActions.fetchStatus);

  const updatedAt = new Date(repo.updatedAt).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const latestRun = summary?.latestRun ?? null;
  const latestRunUpdatedAt = latestRun
    ? new Date(latestRun.updatedAt).toLocaleString(i18n.resolvedLanguage ?? i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;
  const actionsState: RepoActionDisplayState = summary?.state ?? (actionsFetchStatus === 'loading' ? 'loading' : 'empty');
  const workflowLabel = latestRun
    ? `${latestRun.workflowName} #${latestRun.runNumber}`
    : actionsState === 'loading'
      ? t('repoCard.actionsScanning')
      : actionsState === 'error'
        ? t('repoCard.actionsUnavailable')
        : t('repoCard.noRuns');
  const primaryTarget = latestRun?.htmlUrl ?? `${repo.htmlUrl}/actions`;
  const primaryLabel = latestRun ? t('repoCard.openLatestRun') : t('repoCard.openActions');

  return (
    <div className="grid gap-4 px-5 py-4 transition-colors hover:bg-accent/18 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.95fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={repo.owner.avatarUrl} alt={repo.owner.login} className="size-10 rounded-xl border border-border/70 object-cover" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-semibold text-foreground">{repo.fullName}</h4>
              <Badge variant={repo.isPrivate ? 'default' : 'outline'}>
                {repo.isPrivate ? <LockKeyhole className="size-3.5" /> : <Radio className="size-3.5" />}
                {repo.isPrivate ? t('repoCard.private') : t('repoCard.public')}
              </Badge>
              {repo.isFork ? (
                <Badge variant="secondary">
                  <GitFork className="size-3.5" /> {t('repoCard.fork')}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{repo.name}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {repo.description?.trim().length ? repo.description : t('repoCard.noDescription')}
        </p>
      </div>

      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.owner')}</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">@{repo.owner.login}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.updated')}</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">{updatedAt}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.actions')}</dt>
          <dd className="mt-1 space-y-2 text-xs text-foreground">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium',
                actionsState === 'loading' && 'border-sky-400/20 bg-sky-300/8 text-sky-100',
                actionsState === 'running' && 'border-amber-400/25 bg-amber-300/10 text-amber-100',
                actionsState === 'passed' && 'border-emerald-400/25 bg-emerald-300/10 text-emerald-100',
                actionsState === 'failed' && 'border-red-400/25 bg-red-300/10 text-red-100',
                actionsState === 'empty' && 'border-border/70 bg-background/45 text-muted-foreground',
                actionsState === 'error' && 'border-red-400/25 bg-red-300/10 text-red-100',
              )}
            >
              {actionsState === 'loading' ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {actionsState === 'running' ? <Workflow className="size-3.5" /> : null}
              {actionsState === 'passed' ? <CheckCircle2 className="size-3.5" /> : null}
              {actionsState === 'failed' || actionsState === 'error' ? <TriangleAlert className="size-3.5" /> : null}
              {actionsState === 'empty' ? <Workflow className="size-3.5" /> : null}
              {t(`repoCard.state.${actionsState}`)}
            </span>
            <p className="text-xs text-muted-foreground">{workflowLabel}</p>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.lastRun')}</dt>
          <dd className="mt-1 space-y-1 text-xs text-foreground">
            <p className="font-mono">{latestRunUpdatedAt ?? t('repoCard.noRuns')}</p>
            {latestRun ? <p className="text-muted-foreground">{t('repoCard.triggeredBy', { event: latestRun.event })}</p> : null}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
        <Button variant="outline" size="sm" onClick={() => void window.hagihub.openExternal(repo.htmlUrl)}>
          <ArrowUpRight /> {t('repoCard.openRepo')}
        </Button>
        <Button size="sm" onClick={() => void window.hagihub.openExternal(primaryTarget)}>
          <ArrowUpRight /> {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export default RepoCard;
