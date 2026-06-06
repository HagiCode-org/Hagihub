import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderGit2, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function RepoMultiSelect({
  ownerOptions,
  personalRepos,
  groupedRepos,
  selectedRepoFullNames,
  onToggleRepo,
  reposStatus,
}: RepoMultiSelectProps) {
  const { t } = useTranslation('github');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const selectedRepoSet = new Set(selectedRepoFullNames);
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

  const toggleSection = (key: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [key]: !(current[key] ?? false),
    }));
  };

  const toggleGroupSelection = (repos: GitHubRepo[]) => {
    const allSelected = repos.every((repo) => selectedRepoSet.has(repo.fullName));

    for (const repo of repos) {
      const isSelected = selectedRepoSet.has(repo.fullName);

      if (allSelected || !isSelected) {
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

      <div className='space-y-3'>
        {repoGroups.map((group) => {
          const isCollapsed = collapsedSections[group.key] ?? false;
          const selectedCount = group.repos.filter((repo) => selectedRepoSet.has(repo.fullName)).length;
          const ownerMeta = ownerOptions.find((owner) => owner.key === group.key);
          const allSelected = group.repos.length > 0 && selectedCount === group.repos.length;

          return (
            <section key={group.key} className='list-row overflow-hidden px-4 py-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <button
                  type='button'
                  className='flex min-w-0 items-center gap-3 text-left'
                  onClick={() => toggleSection(group.key)}
                >
                  {isCollapsed ? <ChevronRight className='size-4 text-muted-foreground' /> : <ChevronDown className='size-4 text-muted-foreground' />}
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-sm font-semibold text-foreground'>{group.label}</p>
                      <span className='status-chip'>{ownerMeta?.repoCount ?? group.repos.length}</span>
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {t('actionManagement.transfer.ownerSelectionSummary', {
                        selected: selectedCount,
                        total: group.repos.length,
                      })}
                    </p>
                  </div>
                </button>

                <Button variant='ghost' size='sm' onClick={() => toggleGroupSelection(group.repos)}>
                  {allSelected
                    ? t('actionManagement.transfer.deselectAll')
                    : t('actionManagement.transfer.selectAll')}
                </Button>
              </div>

              {!isCollapsed ? (
                <div className='mt-4 space-y-2'>
                  {group.repos.map((repo) => {
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
                        <div className='min-w-0 flex-1 space-y-1'>
                          <div className='flex items-center gap-2 text-sm font-medium text-foreground'>
                            <FolderGit2 className='size-4 shrink-0 text-primary' />
                            <span className='font-mono'>{repo.fullName}</span>
                          </div>
                          {repo.description ? (
                            <p className='text-sm leading-6 text-muted-foreground'>{repo.description}</p>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default RepoMultiSelect;
