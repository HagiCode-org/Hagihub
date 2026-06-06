import { useDeferredValue, useMemo } from 'react';
import { LoaderCircle, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchRepos, setSearchQuery, setVisibilityFilter, type VisibilityFilter } from '@/store/slices/githubReposSlice';
import OrgFilterBar from './OrgFilterBar';
import RepoGroup from './RepoGroup';

interface RepoListProps {
  activeAccountId: string;
}

const visibilityOptions: VisibilityFilter[] = ['all', 'public', 'private'];

function RepoList({ activeAccountId }: RepoListProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const {
    groupedRepos,
    personalRepos,
    activeOrgFilter,
    searchQuery,
    visibilityFilter,
    fetchStatus,
    error,
    repos,
  } = useAppSelector((state) => state.githubRepos);
  const deferredGroups = useDeferredValue(groupedRepos);
  const deferredPersonalRepos = useDeferredValue(personalRepos);

  const filteredGroups = useMemo(() => {
    let groups = activeOrgFilter === 'all'
      ? deferredGroups
      : activeOrgFilter === 'personal'
        ? []
        : deferredGroups.filter((group) => group.org.login === activeOrgFilter);

    let personal = activeOrgFilter === 'all'
      ? deferredPersonalRepos
      : activeOrgFilter === 'personal'
        ? deferredPersonalRepos
        : [];

    if (visibilityFilter !== 'all') {
      const isPrivate = visibilityFilter === 'private';
      groups = groups
        .map((group) => ({
          ...group,
          repos: group.repos.filter((repo) => repo.isPrivate === isPrivate),
        }))
        .filter((group) => group.repos.length > 0);
      personal = personal.filter((repo) => repo.isPrivate === isPrivate);
    }

    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      groups = groups
        .map((group) => ({
          ...group,
          repos: group.repos.filter(
            (repo) =>
              repo.name.toLowerCase().includes(query)
              || repo.fullName.toLowerCase().includes(query)
              || (repo.description?.toLowerCase().includes(query) ?? false),
          ),
        }))
        .filter((group) => group.repos.length > 0);
      personal = personal.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query)
          || repo.fullName.toLowerCase().includes(query)
          || (repo.description?.toLowerCase().includes(query) ?? false),
      );
    }

    return { groups, personal };
  }, [activeOrgFilter, deferredGroups, deferredPersonalRepos, searchQuery, visibilityFilter]);

  const refresh = async () => {
    await dispatch(fetchRepos({ accountId: activeAccountId, forceRefresh: true }));
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

  if (repos.length === 0) {
    return (
      <section className="editor-panel px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
        <p className="text-base font-medium text-foreground">{t('repoList.emptyTitle')}</p>
      </section>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <section className="editor-panel flex-shrink-0 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              placeholder={t('repoList.searchPlaceholder')}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {visibilityOptions.map((option) => {
              const isActive = option === visibilityFilter;

              return (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background/35 text-muted-foreground hover:border-border hover:bg-accent/18 hover:text-accent-foreground',
                  )}
                  onClick={() => dispatch(setVisibilityFilter(option))}
                >
                  {t(`repoList.visibility${option.charAt(0).toUpperCase() + option.slice(1)}`)}
                </button>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw /> {t('repos.refreshRepos')}
          </Button>
        </div>

        <div className="mt-3">
          <OrgFilterBar />
        </div>
      </section>

      <div className="min-h-0 overflow-y-auto pr-1">
        <div className="space-y-4 pb-1">
          {filteredGroups.groups.map((group) => (
            <RepoGroup key={group.org.id} org={group.org} repos={group.repos} />
          ))}
          {filteredGroups.personal.length > 0 ? <RepoGroup org={null} repos={filteredGroups.personal} /> : null}
        </div>
      </div>
    </div>
  );
}

export default RepoList;
