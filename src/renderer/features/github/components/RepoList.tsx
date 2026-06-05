import { useDeferredValue, useMemo } from 'react';
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRepos } from '@/store/slices/githubReposSlice';
import OrgFilterBar from './OrgFilterBar';
import RepoGroup from './RepoGroup';

interface RepoListProps {
  activeAccountId: string;
}

function RepoList({ activeAccountId }: RepoListProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { groupedRepos, personalRepos, activeOrgFilter, fetchStatus, error, repos } = useAppSelector((state) => state.githubRepos);
  const deferredGroups = useDeferredValue(groupedRepos);
  const deferredPersonalRepos = useDeferredValue(personalRepos);

  const filteredGroups = useMemo(() => {
    if (activeOrgFilter === 'all') {
      return { groups: deferredGroups, personal: deferredPersonalRepos };
    }

    if (activeOrgFilter === 'personal') {
      return { groups: [], personal: deferredPersonalRepos };
    }

    const match = deferredGroups.filter((group) => group.org.login === activeOrgFilter);
    return { groups: match, personal: [] };
  }, [activeOrgFilter, deferredGroups, deferredPersonalRepos]);

  const refresh = async () => {
    await dispatch(fetchRepos(activeAccountId));
  };

  if (fetchStatus === 'loading') {
    return (
      <section className="editor-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-medium text-foreground">{t('repoList.loading')}</p>
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
            <Badge variant="secondary">{t('repoList.eyebrow')}</Badge>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('repoList.title')}</h3>
          </div>

          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw /> {t('repos.refreshRepos')}
          </Button>
        </div>
      </section>

      {repos.length === 0 ? (
        <section className="editor-panel px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t('repoList.emptyTitle')}</p>
        </section>
      ) : (
        <div className="space-y-4">
          <OrgFilterBar />
          {filteredGroups.groups.map((group) => (
            <RepoGroup key={group.org.id} org={group.org} repos={group.repos} />
          ))}
          {filteredGroups.personal.length > 0 ? <RepoGroup org={null} repos={filteredGroups.personal} /> : null}
        </div>
      )}
    </div>
  );
}

export default RepoList;
