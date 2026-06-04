import { useDeferredValue } from 'react';
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRepos } from '@/store/slices/githubReposSlice';
import RepoGroup from './RepoGroup';

interface RepoListProps {
  activeAccountId: string;
}

const RECENT_REPO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function RepoList({ activeAccountId }: RepoListProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { groupedRepos, orgs, personalRepos, fetchStatus, error, repos } = useAppSelector((state) => state.githubRepos);
  const {
    summariesByRepoFullName,
    fetchStatus: actionsFetchStatus,
    failedCount: actionsFailedCount,
    error: actionsError,
  } = useAppSelector((state) => state.githubActions);
  const deferredGroups = useDeferredValue(groupedRepos);
  const deferredPersonalRepos = useDeferredValue(personalRepos);
  const actionSummaries = Object.values(summariesByRepoFullName).filter((summary) => summary !== undefined);
  const privateRepoCount = repos.filter((repo) => repo.isPrivate).length;
  const recentRepoCount = repos.filter((repo) => Date.now() - Date.parse(repo.updatedAt) <= RECENT_REPO_WINDOW_MS).length;
  const runningCount = actionSummaries.filter((summary) => summary.state === 'running').length;
  const failedCount = actionSummaries.filter((summary) => summary.state === 'failed').length + actionsFailedCount;
  const passedCount = actionSummaries.filter((summary) => summary.state === 'passed').length;

  const refresh = async () => {
    await dispatch(fetchRepos(activeAccountId));
  };

  if (fetchStatus === 'loading') {
    return (
      <section className="editor-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-medium text-foreground">{t('repoList.loading')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('repoList.loadingHint')}</p>
      </section>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <section className="editor-panel border-destructive/30 bg-destructive/6 px-6 py-8">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 text-destructive" />
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-destructive">{t('repoList.loadFailed')}</p>
              <p className="mt-2 text-sm leading-7 text-destructive/90">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void refresh()}>
              <RefreshCw /> {t('repoList.retry')}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t('repoList.eyebrow')}</Badge>
              <Badge variant="outline">{t('repoList.actionsTitle')}</Badge>
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('repoList.title')}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">{t('repoList.actionsDescription')}</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw /> {t('workspace.refreshRepos')}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.repos')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{repos.length}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.organizations')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{orgs.length}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.running')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{runningCount}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.failed')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{failedCount}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.passed')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{passedCount}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.private')}</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{privateRepoCount}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="status-chip">{t('repoList.metrics.updatedCount', { count: recentRepoCount })}</span>
          {actionsFetchStatus === 'loading' ? <span>{t('repoList.actionsLoading')}</span> : null}
          {actionsFetchStatus === 'succeeded' ? <span>{t('repoList.actionsLoaded', { count: actionSummaries.length })}</span> : null}
          {actionsFailedCount > 0 ? <span>{t('repoList.actionsPartialFailure', { count: actionsFailedCount })}</span> : null}
        </div>
      </section>

      {error || actionsError ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100/90">
          {error ?? actionsError}
        </div>
      ) : null}

      {repos.length === 0 ? (
        <section className="editor-panel px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t('repoList.emptyTitle')}</p>
          <p className="mt-2">{t('repoList.emptyDescription')}</p>
        </section>
      ) : (
        <div className="space-y-4">
          {deferredGroups.map((group) => (
            <RepoGroup key={group.org.id} org={group.org} repos={group.repos} />
          ))}
          {deferredPersonalRepos.length > 0 ? <RepoGroup org={null} repos={deferredPersonalRepos} /> : null}
        </div>
      )}
    </div>
  );
}

export default RepoList;
