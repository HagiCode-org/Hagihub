import { useEffect, useState } from 'react';
import { LoaderCircle, Plus, RefreshCw, Search, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveGitHubAccount, selectFilteredGitHubRepos } from '@/store/selectors';
import type { GitHubRepo } from '../../../../shared/api';
import {
  createRepo,
  dismissCreateFeedback,
  fetchRepos,
  resetCreateDialogState,
  setSearchQuery,
  setVisibilityFilter,
  type VisibilityFilter,
} from '@/store/slices/githubReposSlice';
import CreateRepositoryDialog from './CreateRepositoryDialog';
import OrgFilterBar from './OrgFilterBar';
import RepoGroup from './RepoGroup';
import RepoInfoSheet from './RepoInfoSheet';

interface RepoListProps {
  activeAccountId: string;
}

const visibilityOptions: VisibilityFilter[] = ['all', 'public', 'private'];

function RepoList({ activeAccountId }: RepoListProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [repoInfoTarget, setRepoInfoTarget] = useState<GitHubRepo | null>(null);
  const {
    orgs,
    searchQuery,
    visibilityFilter,
    fetchStatus,
    error,
    repos,
    createStatus,
    createError,
    lastCreatedRepoFullName,
    lastCreateRefreshError,
  } = useAppSelector((state) => state.githubRepos);
  const activeAccount = useAppSelector(selectActiveGitHubAccount);
  const filteredRepos = useAppSelector(selectFilteredGitHubRepos);

  const refresh = async () => {
    await dispatch(fetchRepos({ accountId: activeAccountId, forceRefresh: true }));
  };

  useEffect(() => {
    if (createStatus !== 'succeeded') {
      return;
    }

    setIsCreateDialogOpen(false);
    dispatch(resetCreateDialogState());
  }, [createStatus, dispatch]);

  const openCreateDialog = () => {
    dispatch(resetCreateDialogState());
    setIsCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (createStatus === 'loading') {
      return;
    }

    dispatch(resetCreateDialogState());
    setIsCreateDialogOpen(false);
  };

  const openRepoInfo = (repo: GitHubRepo) => {
    dispatch(resetCreateDialogState());
    setIsCreateDialogOpen(false);
    setRepoInfoTarget(repo);
  };

  const createButton = (
    <Button onClick={openCreateDialog} size="sm" disabled={!activeAccount || createStatus === 'loading'}>
      {createStatus === 'loading' ? <LoaderCircle className="animate-spin" /> : <Plus />}
      {createStatus === 'loading' ? t('createDialog.creating') : t('repoList.createAction')}
    </Button>
  );

  const createDialog = (
    <CreateRepositoryDialog
      open={isCreateDialogOpen}
      activeAccount={activeAccount}
      orgs={orgs}
      repos={repos}
      submitStatus={createStatus}
      submissionError={createError}
      onClose={closeCreateDialog}
      onDismissError={() => dispatch(resetCreateDialogState())}
      onSubmit={(payload) => {
        void dispatch(createRepo({ accountId: activeAccountId, payload }));
      }}
      onViewExistingRepo={openRepoInfo}
    />
  );

  const repoInfoSheet = repoInfoTarget ? (
    <RepoInfoSheet
      owner={repoInfoTarget.owner.login}
      repo={repoInfoTarget.name}
      onClose={() => setRepoInfoTarget(null)}
    />
  ) : null;

  if (fetchStatus === 'loading') {
    return (
      <>
        <section className="editor-panel px-6 py-12 text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-base font-medium text-foreground">{t('repoList.loading')}</p>
        </section>

        {createDialog}
        {repoInfoSheet}
      </>
    );
  }

  if (fetchStatus === 'failed') {
    return (
      <>
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

        {createDialog}
        {repoInfoSheet}
      </>
    );
  }

  if (repos.length === 0) {
    return (
      <>
        <section className="editor-panel px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t('repoList.emptyTitle')}</p>
          <p className="mt-3 max-w-2xl mx-auto">{t('repoList.emptyDescription')}</p>
          <div className="mt-6 flex justify-center">
            {createButton}
          </div>
        </section>

        {createDialog}
        {repoInfoSheet}
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {lastCreatedRepoFullName ? (
          <section className="editor-panel border-primary/25 bg-primary/8 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('createDialog.successTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('createDialog.successMessage', { repo: lastCreatedRepoFullName })}</p>
                {lastCreateRefreshError ? (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{lastCreateRefreshError}</p>
                ) : null}
              </div>
              <Button variant="ghost" size="icon" onClick={() => dispatch(dismissCreateFeedback())} aria-label={t('repoList.dismissFeedback')}>
                <X />
              </Button>
            </div>
          </section>
        ) : null}

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

          {createButton}
        </div>

        <div className="mt-3">
          <OrgFilterBar />
        </div>
        </section>

        <div className="min-h-0 overflow-y-auto pr-1">
          {filteredRepos.showFilteredEmpty ? (
            <section className="editor-panel px-6 py-10 text-center text-sm leading-7 text-muted-foreground">
              <p className="text-base font-medium text-foreground">{t('repoList.filteredEmptyTitle')}</p>
              <p className="mt-3 max-w-2xl mx-auto">{t('repoList.filteredEmptyDescription')}</p>
            </section>
          ) : (
            <div className="space-y-4 pb-1">
              {filteredRepos.groupedRepos.map((group) => (
                <RepoGroup key={group.org.id} org={group.org} repos={group.repos} />
              ))}
              {filteredRepos.personalRepos.length > 0 ? <RepoGroup org={null} repos={filteredRepos.personalRepos} /> : null}
            </div>
          )}
        </div>
      </div>

      {createDialog}
      {repoInfoSheet}
    </>
  );
}

export default RepoList;
