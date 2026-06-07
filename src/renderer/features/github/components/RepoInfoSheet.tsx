import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectRepoWorkspaceDetailsState } from '@/store/selectors';
import { buildRepoWorkspaceKey, fetchRepoWorkspaceDetails } from '@/store/slices/repoWorkspaceSlice';
import RepoInfoTab from './RepoInfoTab';
import RepoLicenseTab from './RepoLicenseTab';
import RepoReadmeTab from './RepoReadmeTab';

interface RepoInfoSheetProps {
  owner: string;
  repo: string;
  onClose: () => void;
}

function RepoInfoSheet({ owner, repo, onClose }: RepoInfoSheetProps) {
  const { t, i18n } = useTranslation('github');
  const dispatch = useAppDispatch();
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const workspaceKey = buildRepoWorkspaceKey(activeAccountId, owner, repo);
  const detailsState = useAppSelector((state) => selectRepoWorkspaceDetailsState(state, workspaceKey));
  const locale = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    if (!activeAccountId) {
      return;
    }

    void dispatch(fetchRepoWorkspaceDetails({
      workspaceKey,
      accountId: activeAccountId,
      owner,
      repo,
    }));
  }, [activeAccountId, dispatch, owner, repo, workspaceKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const loadStatus = detailsState?.loadStatus ?? (activeAccountId ? 'loading' : 'idle');
  const details = detailsState?.data ?? null;
  const error = detailsState?.error ?? null;

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('repoCard.info.title')}
    >
      <div className="flex h-full w-[90vw] max-w-none flex-col border-l border-border/70 bg-[var(--surface-panel)]/98 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
          <div className="flex items-center gap-3">
            <Info className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('repoCard.info.title')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{owner}/{repo}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {loadStatus === 'loading' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t('repoList.loading')}</p>
          </div>
        ) : loadStatus === 'failed' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                if (!activeAccountId) {
                  return;
                }

                void dispatch(fetchRepoWorkspaceDetails({
                  workspaceKey,
                  accountId: activeAccountId,
                  owner,
                  repo,
                }));
              }}
            >
              {t('repoList.retry')}
            </Button>
          </div>
        ) : details ? (
          <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/70 px-6 py-4">
              <div>
                <p className="text-lg font-semibold text-foreground">{details.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('repoCard.tabs.description')}</p>
              </div>
              <div className="mt-4">
                <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-transparent p-0">
                  <TabsTrigger value="info" className="min-w-fit justify-start border border-border/70 bg-background/35 px-4">{t('repoCard.tabs.info')}</TabsTrigger>
                  <TabsTrigger value="readme" className="min-w-fit justify-start border border-border/70 bg-background/35 px-4">{t('repoCard.tabs.readme')}</TabsTrigger>
                  <TabsTrigger value="license" className="min-w-fit justify-start border border-border/70 bg-background/35 px-4">{t('repoCard.tabs.license')}</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="info" forceMount className="mt-0 min-h-0 flex-1">
              <RepoInfoTab
                workspaceKey={workspaceKey}
                accountId={activeAccountId}
                owner={owner}
                repo={repo}
                locale={locale}
              />
            </TabsContent>
            <TabsContent value="readme" forceMount className="mt-0 min-h-0 flex-1">
              <RepoReadmeTab
                accountId={activeAccountId}
                owner={owner}
                repo={repo}
                defaultBranch={details.defaultBranch}
              />
            </TabsContent>
            <TabsContent value="license" forceMount className="mt-0 min-h-0 flex-1">
              <RepoLicenseTab
                accountId={activeAccountId}
                owner={owner}
                repo={repo}
                defaultBranch={details.defaultBranch}
              />
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default RepoInfoSheet;
