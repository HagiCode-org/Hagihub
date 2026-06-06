import { useCallback, useEffect, useState } from 'react';
import { Info, LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppSelector } from '@/store';
import RepoInfoTab from './RepoInfoTab';
import RepoLicenseTab from './RepoLicenseTab';
import RepoReadmeTab from './RepoReadmeTab';
import type { GitHubRepoDetails } from '../../../../shared/api';

interface RepoInfoSheetProps {
  owner: string;
  repo: string;
  onClose: () => void;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function RepoInfoSheet({ owner, repo, onClose }: RepoInfoSheetProps) {
  const { t, i18n } = useTranslation('github');
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const [details, setDetails] = useState<GitHubRepoDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const loadDetails = useCallback(async () => {
    if (!activeAccountId) {
      return;
    }

    setLoadState('loading');
    setError(null);

    try {
      const result = await window.hagihub.fetchRepoDetails(activeAccountId, owner, repo);
      setDetails(result.details);
      setLoadState('loaded');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoadState('error');
    }
  }, [activeAccountId, owner, repo]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
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

        {loadState === 'loading' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">{t('repoList.loading')}</p>
          </div>
        ) : loadState === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadDetails()}>
              {t('repoList.retry')}
            </Button>
          </div>
        ) : details ? (
          <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border/70 px-6 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">{details.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('repoCard.tabs.description')}</p>
                </div>
                <TabsList className="grid w-full grid-cols-3 xl:w-auto">
                  <TabsTrigger value="info" className="w-full">{t('repoCard.tabs.info')}</TabsTrigger>
                  <TabsTrigger value="readme" className="w-full">{t('repoCard.tabs.readme')}</TabsTrigger>
                  <TabsTrigger value="license" className="w-full">{t('repoCard.tabs.license')}</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="info" forceMount className="mt-0 min-h-0 flex-1">
              <RepoInfoTab
                accountId={activeAccountId}
                owner={owner}
                repo={repo}
                locale={locale}
                details={details}
                onDetailsChange={setDetails}
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
    </div>
  );
}

export default RepoInfoSheet;
