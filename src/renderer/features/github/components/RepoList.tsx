import { useDeferredValue } from 'react';
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRepos } from '@/store/slices/githubReposSlice';
import RepoGroup from './RepoGroup';

interface RepoListProps {
  activeAccountId: string;
}

function RepoList({ activeAccountId }: RepoListProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { groupedRepos, personalRepos, fetchStatus, error, repos } = useAppSelector((state) => state.githubRepos);
  const deferredGroups = useDeferredValue(groupedRepos);
  const deferredPersonalRepos = useDeferredValue(personalRepos);

  const refresh = async () => {
    await dispatch(fetchRepos(activeAccountId));
  };

  if (fetchStatus === 'loading') {
    return (
      <div className="rounded-[1.75rem] border border-border/70 bg-background/45 px-6 py-12 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-medium text-foreground">{t('repoList.loading')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('repoList.loadingHint')}</p>
      </div>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <div className="rounded-[1.75rem] border border-destructive/30 bg-destructive/8 px-6 py-8">
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
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.eyebrow')}</p>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('repoList.title')}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{t('repoList.description')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw /> {t('workspace.refreshRepos')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-[1.5rem] border border-amber-400/20 bg-amber-300/10 px-4 py-3 text-sm leading-7 text-amber-100/90">
          {error}
        </div>
      ) : null}

      {repos.length === 0 ? (
        <div className="rounded-[1.75rem] border border-border/70 bg-background/45 px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t('repoList.emptyTitle')}</p>
          <p className="mt-2">{t('repoList.emptyDescription')}</p>
        </div>
      ) : (
        <div className="space-y-5">
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
