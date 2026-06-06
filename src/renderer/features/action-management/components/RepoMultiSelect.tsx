import { useDeferredValue, useEffect, useState } from 'react';
import { ChevronDown, FolderGit2, LoaderCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GitHubRepo } from '../../../../shared/api';
import type { GitHubRepoGroup } from '@/store/slices/githubReposSlice';

export interface RepoOwnerOption {
  key: string;
  label: string;
  repoCount: number;
}

interface RepoMultiSelectProps {
  ownerOptions: RepoOwnerOption[];
  personalRepos: GitHubRepo[];
  groupedRepos: GitHubRepoGroup[];
  selectedRepoFullNames: string[];
  onToggleRepo: (repoFullName: string) => void;
  reposStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

function resolveOwnerKeyForRepo(
  repoFullName: string,
  personalRepos: GitHubRepo[],
  groupedRepos: GitHubRepoGroup[],
): string | null {
  if (personalRepos.some((repo) => repo.fullName === repoFullName)) {
    return 'personal';
  }

  for (const group of groupedRepos) {
    if (group.repos.some((repo) => repo.fullName === repoFullName)) {
      return group.org.login;
    }
  }

  return null;
}

function RepoMultiSelect({
  ownerOptions,
  personalRepos,
  groupedRepos,
  selectedRepoFullNames,
  onToggleRepo,
  reposStatus,
}: RepoMultiSelectProps) {
  const { t } = useTranslation('github');
  const [searchQuery, setSearchQuery] = useState('');
  const repoGroups = [
    ...(personalRepos.length > 0
      ? [{
        key: 'personal',
        label: t('actionManagement.transfer.personalOwner'),
        repos: personalRepos,
      }]
      : []),
    ...groupedRepos.map((group) => ({
      key: group.org.login,
      label: group.org.login,
      repos: group.repos,
    })),
  ];
  const initialOwnerKey = selectedRepoFullNames
    .map((repoFullName) => resolveOwnerKeyForRepo(repoFullName, personalRepos, groupedRepos))
    .find((ownerKey): ownerKey is string => ownerKey !== null)
    ?? ownerOptions[0]?.key
    ?? repoGroups[0]?.key
    ?? '';
  const [selectedOwnerKey, setSelectedOwnerKey] = useState(initialOwnerKey);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const selectedRepoSet = new Set(selectedRepoFullNames);
  const activeGroup = repoGroups.find((group) => group.key === selectedOwnerKey) ?? repoGroups[0] ?? null;
  const visibleRepos = activeGroup?.repos.filter((repo) => {
    if (!deferredQuery) {
      return true;
    }

    const haystack = [repo.fullName, repo.name]
      .join(' ')
      .toLowerCase();

    return haystack.includes(deferredQuery);
  }) ?? [];
  const activeOwnerOption = ownerOptions.find((owner) => owner.key === activeGroup?.key) ?? null;
  const activeSelectedCount = activeGroup?.repos.filter((repo) => selectedRepoSet.has(repo.fullName)).length ?? 0;
  const allActiveReposSelected = activeGroup !== null
    && activeGroup.repos.length > 0
    && activeSelectedCount === activeGroup.repos.length;

  useEffect(() => {
    if (!repoGroups.some((group) => group.key === selectedOwnerKey)) {
      setSelectedOwnerKey(initialOwnerKey);
    }
  }, [initialOwnerKey, repoGroups, selectedOwnerKey]);

  const toggleActiveOwnerSelection = () => {
    if (!activeGroup) {
      return;
    }

    for (const repo of activeGroup.repos) {
      const isSelected = selectedRepoSet.has(repo.fullName);

      if (allActiveReposSelected ? isSelected : !isSelected) {
        onToggleRepo(repo.fullName);
      }
    }
  };

  if (reposStatus === 'loading') {
    return (
      <div className='panel-muted flex items-center gap-3 px-4 py-5 text-sm text-muted-foreground'>
        <LoaderCircle className='size-4 animate-spin text-primary' />
        {t('actionManagement.transfer.loadingRepos')}
      </div>
    );
  }

  if (repoGroups.length === 0) {
    return (
      <div className='panel-muted px-4 py-5 text-sm leading-6 text-muted-foreground'>
        {t('actionManagement.transfer.noReposAvailable')}
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='space-y-2'>
          <Badge>{t('actionManagement.transfer.phaseRepos')}</Badge>
          <p className='text-sm leading-6 text-muted-foreground'>{t('actionManagement.transfer.repoSelectionHint')}</p>
        </div>
        <div className='status-chip'>{t('actionManagement.transfer.reposSelected', { count: selectedRepoFullNames.length })}</div>
      </div>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
        <label className='block space-y-2'>
          <span className='text-sm font-medium text-foreground'>{t('actionManagement.transfer.ownerLabel')}</span>
          <div className='relative'>
            <select
              value={activeGroup?.key ?? ''}
              onChange={(event) => setSelectedOwnerKey(event.target.value)}
              className='h-11 w-full appearance-none rounded-xl border border-border/70 bg-background/70 px-4 pr-10 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20'
            >
              {ownerOptions.map((owner) => (
                <option key={owner.key} value={owner.key}>
                  {t('actionManagement.transfer.ownerOptionLabel', {
                    label: owner.label,
                    count: owner.repoCount,
                  })}
                </option>
              ))}
            </select>
            <ChevronDown className='pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          </div>
          <p className='text-xs leading-5 text-muted-foreground'>
            {t('actionManagement.transfer.ownerSelectionHint')}
          </p>
        </label>

        {activeGroup ? (
          <div className='status-chip'>
            {t('actionManagement.transfer.ownerSelectionSummary', {
              selected: activeSelectedCount,
              total: activeGroup.repos.length,
            })}
          </div>
        ) : null}
      </div>

      <label className='block'>
        <span className='sr-only'>{t('actionManagement.transfer.repoSearchPlaceholder')}</span>
        <div className='relative'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('actionManagement.transfer.repoSearchPlaceholder')}
            className='h-11 pl-10'
          />
        </div>
      </label>

      {activeGroup ? (
        <section className='list-row overflow-hidden'>
          <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-sm font-semibold text-foreground'>{activeGroup.label}</p>
                <span className='status-chip'>{activeOwnerOption?.repoCount ?? activeGroup.repos.length}</span>
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                {t('actionManagement.transfer.ownerRepoCount', {
                  count: activeOwnerOption?.repoCount ?? activeGroup.repos.length,
                })}
              </p>
            </div>

            <Button variant='ghost' size='sm' onClick={toggleActiveOwnerSelection}>
              {allActiveReposSelected
                ? t('actionManagement.transfer.deselectAll')
                : t('actionManagement.transfer.selectAll')}
            </Button>
          </div>

          <div className='h-[26rem] overflow-y-auto px-4 py-4'>
            {visibleRepos.length === 0 ? (
              <div className='panel-muted px-4 py-5 text-sm leading-6 text-muted-foreground'>
                {deferredQuery
                  ? t('actionManagement.transfer.noRepoSearchResults')
                  : t('actionManagement.transfer.noReposAvailable')}
              </div>
            ) : (
              <div className='space-y-2'>
                {visibleRepos.map((repo) => {
                  const isSelected = selectedRepoSet.has(repo.fullName);

                  return (
                    <label
                      key={repo.id}
                      className='flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-background/25 px-3 py-3 transition-colors hover:bg-accent/12'
                    >
                      <input
                        type='checkbox'
                        checked={isSelected}
                        className='mt-1 size-4 rounded border border-border/80 bg-background'
                        onChange={() => onToggleRepo(repo.fullName)}
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2 text-sm font-medium text-foreground'>
                          <FolderGit2 className='size-4 shrink-0 text-primary' />
                          <span className='font-mono'>{repo.fullName}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default RepoMultiSelect;
