import { ChevronDown, FolderGit2, LoaderCircle, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FetchStatus } from '@/features/action-management/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActionTransferRepoSelectionView } from '@/store/selectors';
import {
  setTransferRepoBatchSelection,
  setTransferRepoSearchQuery,
  setTransferSelectedOwnerKey,
  toggleRepoSelection,
} from '@/store/slices/actionManagementSlice';

interface RepoMultiSelectProps {
  reposStatus: FetchStatus;
}

function RepoMultiSelect({ reposStatus }: RepoMultiSelectProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const {
    activeGroup,
    activeOwnerKey,
    activeSelectedCount,
    allActiveReposSelected,
    repoGroups,
    repoSearchQuery,
    selectedRepoCount,
    selectedRepoSet,
    visibleRepos,
  } = useAppSelector(selectActionTransferRepoSelectionView);

  const ownerOptions = repoGroups.map((group) => ({
    key: group.key,
    label: group.key === 'personal' ? t('actionManagement.transfer.personalOwner') : group.key,
    repoCount: group.repos.length,
  }));

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
        <div className='status-chip'>{t('actionManagement.transfer.reposSelected', { count: selectedRepoCount })}</div>
      </div>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'>
        <label className='block space-y-2'>
          <span className='text-sm font-medium text-foreground'>{t('actionManagement.transfer.ownerLabel')}</span>
          <div className='relative'>
            <select
              value={activeOwnerKey}
              onChange={(event) => dispatch(setTransferSelectedOwnerKey(event.target.value))}
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
            value={repoSearchQuery}
            onChange={(event) => dispatch(setTransferRepoSearchQuery(event.target.value))}
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
                <p className='text-sm font-semibold text-foreground'>
                  {activeGroup.key === 'personal' ? t('actionManagement.transfer.personalOwner') : activeGroup.key}
                </p>
                <span className='status-chip'>{activeGroup.repos.length}</span>
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                {t('actionManagement.transfer.ownerRepoCount', {
                  count: activeGroup.repos.length,
                })}
              </p>
            </div>

            <Button
              variant='ghost'
              size='sm'
              onClick={() => dispatch(setTransferRepoBatchSelection({
                repoFullNames: activeGroup.repos.map((repo) => repo.fullName),
                select: !allActiveReposSelected,
              }))}
            >
              {allActiveReposSelected
                ? t('actionManagement.transfer.deselectAll')
                : t('actionManagement.transfer.selectAll')}
            </Button>
          </div>

          <div className='h-[26rem] overflow-y-auto px-4 py-4'>
            {visibleRepos.length === 0 ? (
              <div className='panel-muted px-4 py-5 text-sm leading-6 text-muted-foreground'>
                {repoSearchQuery.trim().length > 0
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
                        onChange={() => dispatch(toggleRepoSelection(repo.fullName))}
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
