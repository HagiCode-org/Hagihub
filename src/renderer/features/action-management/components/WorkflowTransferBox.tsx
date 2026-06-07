import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Eye, Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { workflowKey } from '@/features/action-management/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActionTransferWorkflowSelectionView } from '@/store/selectors';
import {
  moveToStaged,
  removeFromStaged,
  setTransferAvailableWorkflowBatchSelection,
  setTransferWorkflowSearchQuery,
  toggleTransferAvailableWorkflowKey,
  toggleTransferStagedWorkflowKey,
} from '@/store/slices/actionManagementSlice';
import type { GitHubManagedWorkflowReference, GitHubWorkflowSummary } from '../../../../shared/api';

function renderRecommendationBadges(
  recommendations: Array<{ type: 'watch' | 'include'; reason?: string }>,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (recommendations.length === 0) {
    return <span className='text-xs text-muted-foreground'>-</span>;
  }

  return (
    <div className='flex flex-wrap gap-2'>
      {recommendations.map((recommendation, index) => (
        <Badge
          key={`${recommendation.type}-${recommendation.reason ?? 'plain'}-${index}`}
          variant={recommendation.type === 'watch' ? 'secondary' : 'outline'}
          title={recommendation.reason}
          className='gap-1'
        >
          {recommendation.type === 'watch'
            ? <Eye className='size-3.5' />
            : <Star className='size-3.5' />}
          {recommendation.type === 'watch'
            ? t('actionManagement.recommendation.watch')
            : t('actionManagement.recommendation.include')}
        </Badge>
      ))}
    </div>
  );
}

function WorkflowTransferBox() {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const {
    recommendationLookup,
    selectedAvailable,
    selectedAvailableKeys,
    selectedStaged,
    selectedStagedKeys,
    stagedSelection,
    visibleAvailableWorkflows,
    workflowSearchQuery,
  } = useAppSelector(selectActionTransferWorkflowSelectionView);
  const availableWatchRecommendationKeys = visibleAvailableWorkflows
    .filter((workflow) => (recommendationLookup[workflowKey(workflow)] ?? []).some((recommendation) => recommendation.type === 'watch'))
    .map((workflow) => workflowKey(workflow));
  const availableIncludeRecommendationKeys = visibleAvailableWorkflows
    .filter((workflow) => (recommendationLookup[workflowKey(workflow)] ?? []).some((recommendation) => recommendation.type === 'include'))
    .map((workflow) => workflowKey(workflow));

  const renderWorkflowTable = <T extends GitHubManagedWorkflowReference | GitHubWorkflowSummary>(options: {
    emptyState: string;
    onRowDoubleClick: (workflow: T) => void;
    onToggleKey: (key: string) => void;
    rows: T[];
    selectedKeys: string[];
  }) => {
    const { emptyState, onRowDoubleClick, onToggleKey, rows, selectedKeys } = options;
    const selectedKeySet = new Set(selectedKeys);

    if (rows.length === 0) {
      return (
        <div className='panel-muted px-4 py-6 text-sm leading-6 text-muted-foreground'>
          {emptyState}
        </div>
      );
    }

    return (
      <table className='w-full border-collapse'>
        <thead className='sticky top-0 z-10 bg-background/95 backdrop-blur-sm'>
          <tr className='border-b border-border/70 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground'>
            <th className='w-12 px-3 py-3 font-medium'>
              <span className='sr-only'>{t('actionManagement.transfer.selected')}</span>
            </th>
            <th className='px-3 py-3 font-medium'>{t('actionManagement.table.workflow')}</th>
            <th className='px-3 py-3 font-medium'>{t('actionManagement.table.recommendation')}</th>
            <th className='px-3 py-3 font-medium'>{t('repoList.columns.repository')}</th>
            <th className='hidden px-3 py-3 font-medium xl:table-cell'>{t('actionManagement.table.path')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((workflow) => {
            const key = workflowKey(workflow);
            const checked = selectedKeySet.has(key);
            const recommendations = recommendationLookup[key] ?? [];

            return (
              <tr
                key={key}
                className='border-b border-border/60 transition-colors hover:bg-accent/10'
                onDoubleClick={() => onRowDoubleClick(workflow)}
              >
                <td className='px-3 py-3 align-top'>
                  <input
                    type='checkbox'
                    checked={checked}
                    className='mt-0.5 size-4 rounded border border-border/80 bg-background'
                    onChange={() => onToggleKey(key)}
                  />
                </td>
                <td className='px-3 py-3 align-top'>
                  <p className='text-sm font-medium text-foreground'>{workflow.workflowName}</p>
                </td>
                <td className='px-3 py-3 align-top'>
                  {renderRecommendationBadges(recommendations, t)}
                </td>
                <td className='px-3 py-3 align-top font-mono text-xs text-muted-foreground'>
                  {workflow.repoFullName}
                </td>
                <td className='hidden px-3 py-3 align-top font-mono text-xs text-muted-foreground/90 xl:table-cell'>
                  {workflow.workflowPath}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className='grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
      <section className='editor-panel flex h-[18rem] min-h-0 flex-col overflow-hidden p-4 sm:h-[22rem] lg:h-[calc(80vh-20rem)]'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {t('actionManagement.transfer.available', { count: visibleAvailableWorkflows.length })}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>{t('actionManagement.transfer.availableHint')}</p>
          </div>
          <Badge variant='outline'>{visibleAvailableWorkflows.length}</Badge>
        </div>

        <label className='mt-4 block'>
          <span className='sr-only'>{t('actionManagement.transfer.searchPlaceholder')}</span>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              value={workflowSearchQuery}
              onChange={(event) => dispatch(setTransferWorkflowSearchQuery(event.target.value))}
              placeholder={t('actionManagement.transfer.searchPlaceholder')}
              className='h-11 pl-10'
            />
          </div>
        </label>

        <div className='mt-3 flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={availableWatchRecommendationKeys.length === 0}
            onClick={() => dispatch(setTransferAvailableWorkflowBatchSelection({
              workflowKeys: availableWatchRecommendationKeys,
              select: true,
            }))}
          >
            {t('actionManagement.transfer.selectRecommendedWatch', { count: availableWatchRecommendationKeys.length })}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={availableIncludeRecommendationKeys.length === 0}
            onClick={() => dispatch(setTransferAvailableWorkflowBatchSelection({
              workflowKeys: availableIncludeRecommendationKeys,
              select: true,
            }))}
          >
            {t('actionManagement.transfer.selectRecommendedInclude', { count: availableIncludeRecommendationKeys.length })}
          </Button>
        </div>

        <div className='mt-4 min-h-0 flex-1 overflow-auto'>
          {renderWorkflowTable({
            emptyState: workflowSearchQuery.trim().length > 0
              ? t('actionManagement.transfer.noSearchResults')
              : t('actionManagement.transfer.emptyAvailable'),
            onRowDoubleClick: (workflow) => dispatch(moveToStaged([workflow])),
            onToggleKey: (key) => dispatch(toggleTransferAvailableWorkflowKey(key)),
            rows: visibleAvailableWorkflows,
            selectedKeys: selectedAvailableKeys,
          })}
        </div>
      </section>

      <div className='flex flex-row items-center justify-center gap-2 lg:self-center lg:flex-col'>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={selectedAvailable.length === 0}
          onClick={() => dispatch(moveToStaged(selectedAvailable))}
          aria-label={t('actionManagement.transfer.moveSelectedToChosen')}
        >
          <ChevronRight className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={visibleAvailableWorkflows.length === 0}
          onClick={() => dispatch(moveToStaged(visibleAvailableWorkflows))}
          aria-label={t('actionManagement.transfer.moveAllToChosen')}
        >
          <ChevronsRight className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={selectedStaged.length === 0}
          onClick={() => dispatch(removeFromStaged(selectedStaged))}
          aria-label={t('actionManagement.transfer.moveSelectedBack')}
        >
          <ChevronLeft className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={stagedSelection.length === 0}
          onClick={() => dispatch(removeFromStaged(stagedSelection))}
          aria-label={t('actionManagement.transfer.moveAllBack')}
        >
          <ChevronsLeft className='size-4' />
        </Button>
      </div>

      <section className='editor-panel flex h-[18rem] min-h-0 flex-col overflow-hidden p-4 sm:h-[22rem] lg:h-[calc(80vh-20rem)]'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {t('actionManagement.transfer.selected', { count: stagedSelection.length })}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>{t('actionManagement.transfer.selectedHint')}</p>
          </div>
          <Badge variant='outline'>{stagedSelection.length}</Badge>
        </div>

        <div className='mt-4 min-h-0 flex-1 overflow-auto'>
          {renderWorkflowTable({
            emptyState: t('actionManagement.transfer.emptySelected'),
            onRowDoubleClick: (workflow) => dispatch(removeFromStaged([workflow])),
            onToggleKey: (key) => dispatch(toggleTransferStagedWorkflowKey(key)),
            rows: stagedSelection,
            selectedKeys: selectedStagedKeys,
          })}
        </div>
      </section>
    </div>
  );
}

export default WorkflowTransferBox;
