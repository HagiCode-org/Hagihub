import { useDeferredValue, useEffect, useState } from 'react';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GitHubManagedWorkflowReference, GitHubWorkflowSummary } from '../../../../shared/api';

interface WorkflowTransferBoxProps {
  availableWorkflows: GitHubWorkflowSummary[];
  stagedWorkflows: GitHubManagedWorkflowReference[];
  onMoveToStaged: (workflows: GitHubWorkflowSummary[]) => void;
  onRemoveFromStaged: (workflows: GitHubManagedWorkflowReference[]) => void;
}

function workflowKey(workflow: Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>): string {
  return workflow.repoFullName + '#' + workflow.workflowId;
}

function matchesQuery(
  workflow: Pick<GitHubManagedWorkflowReference, 'workflowName' | 'workflowPath' | 'repoFullName'>,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  return workflow.workflowName.toLowerCase().includes(query)
    || workflow.workflowPath.toLowerCase().includes(query)
    || workflow.repoFullName.toLowerCase().includes(query);
}

function WorkflowTransferBox({
  availableWorkflows,
  stagedWorkflows,
  onMoveToStaged,
  onRemoveFromStaged,
}: WorkflowTransferBoxProps) {
  const { t } = useTranslation('github');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAvailableKeys, setSelectedAvailableKeys] = useState<string[]>([]);
  const [selectedStagedKeys, setSelectedStagedKeys] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const stagedKeySet = new Set(stagedWorkflows.map((workflow) => workflowKey(workflow)));
  const visibleAvailableWorkflows = availableWorkflows.filter(
    (workflow) => !stagedKeySet.has(workflowKey(workflow)) && matchesQuery(workflow, deferredQuery),
  );

  useEffect(() => {
    const visibleKeys = new Set(visibleAvailableWorkflows.map((workflow) => workflowKey(workflow)));
    setSelectedAvailableKeys((current) => current.filter((key) => visibleKeys.has(key)));
  }, [visibleAvailableWorkflows]);

  useEffect(() => {
    const stagedKeys = new Set(stagedWorkflows.map((workflow) => workflowKey(workflow)));
    setSelectedStagedKeys((current) => current.filter((key) => stagedKeys.has(key)));
  }, [stagedWorkflows]);

  const selectedAvailable = visibleAvailableWorkflows.filter((workflow) =>
    selectedAvailableKeys.includes(workflowKey(workflow)),
  );
  const selectedStaged = stagedWorkflows.filter((workflow) => selectedStagedKeys.includes(workflowKey(workflow)));

  return (
    <div className='grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
      <section className='editor-panel flex h-[20rem] min-h-0 flex-col p-4 sm:h-[24rem] lg:h-[min(30rem,calc(100vh-24rem))]'>
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('actionManagement.transfer.searchPlaceholder')}
              className='h-11 pl-10'
            />
          </div>
        </label>

        <div className='mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
          {visibleAvailableWorkflows.length === 0 ? (
            <div className='panel-muted px-4 py-6 text-sm leading-6 text-muted-foreground'>
              {availableWorkflows.length === stagedWorkflows.length
                ? t('actionManagement.transfer.emptyAvailable')
                : t('actionManagement.transfer.noSearchResults')}
            </div>
          ) : (
            visibleAvailableWorkflows.map((workflow) => {
              const key = workflowKey(workflow);
              const checked = selectedAvailableKeys.includes(key);

              return (
                <label
                  key={key}
                  className='list-row flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-accent/12'
                  onDoubleClick={() => onMoveToStaged([workflow])}
                >
                  <input
                    type='checkbox'
                    checked={checked}
                    className='mt-1 size-4 rounded border border-border/80 bg-background'
                    onChange={() => {
                      setSelectedAvailableKeys((current) =>
                        checked ? current.filter((item) => item !== key) : [...current, key],
                      );
                    }}
                  />
                  <div className='min-w-0 flex-1 space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-sm font-semibold text-foreground'>{workflow.workflowName}</p>
                      <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                        {workflow.supportsDispatch
                          ? t('actionManagement.card.dispatchReady')
                          : t('actionManagement.card.dispatchUnavailable')}
                      </Badge>
                    </div>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <Workflow className='size-3.5 shrink-0 text-primary' />
                      <span className='font-mono'>{workflow.repoFullName}</span>
                    </div>
                    <p className='font-mono text-xs text-muted-foreground/90'>{workflow.workflowPath}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </section>

      <div className='flex flex-row items-center justify-center gap-2 lg:self-center lg:flex-col'>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={selectedAvailable.length === 0}
          onClick={() => onMoveToStaged(selectedAvailable)}
          aria-label={t('actionManagement.transfer.moveSelectedToChosen')}
        >
          <ChevronRight className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={visibleAvailableWorkflows.length === 0}
          onClick={() => onMoveToStaged(visibleAvailableWorkflows)}
          aria-label={t('actionManagement.transfer.moveAllToChosen')}
        >
          <ChevronsRight className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={selectedStaged.length === 0}
          onClick={() => onRemoveFromStaged(selectedStaged)}
          aria-label={t('actionManagement.transfer.moveSelectedBack')}
        >
          <ChevronLeft className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={stagedWorkflows.length === 0}
          onClick={() => onRemoveFromStaged(stagedWorkflows)}
          aria-label={t('actionManagement.transfer.moveAllBack')}
        >
          <ChevronsLeft className='size-4' />
        </Button>
      </div>

      <section className='editor-panel flex h-[20rem] min-h-0 flex-col p-4 sm:h-[24rem] lg:h-[min(30rem,calc(100vh-24rem))]'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {t('actionManagement.transfer.selected', { count: stagedWorkflows.length })}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>{t('actionManagement.transfer.selectedHint')}</p>
          </div>
          <Badge variant='outline'>{stagedWorkflows.length}</Badge>
        </div>

        <div className='mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
          {stagedWorkflows.length === 0 ? (
            <div className='panel-muted px-4 py-6 text-sm leading-6 text-muted-foreground'>
              {t('actionManagement.transfer.emptySelected')}
            </div>
          ) : (
            stagedWorkflows.map((workflow) => {
              const key = workflowKey(workflow);
              const checked = selectedStagedKeys.includes(key);

              return (
                <label
                  key={key}
                  className='list-row flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-accent/12'
                  onDoubleClick={() => onRemoveFromStaged([workflow])}
                >
                  <input
                    type='checkbox'
                    checked={checked}
                    className='mt-1 size-4 rounded border border-border/80 bg-background'
                    onChange={() => {
                      setSelectedStagedKeys((current) =>
                        checked ? current.filter((item) => item !== key) : [...current, key],
                      );
                    }}
                  />
                  <div className='min-w-0 flex-1 space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-sm font-semibold text-foreground'>{workflow.workflowName}</p>
                      <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                        {workflow.supportsDispatch
                          ? t('actionManagement.card.dispatchReady')
                          : t('actionManagement.card.dispatchUnavailable')}
                      </Badge>
                    </div>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <Workflow className='size-3.5 shrink-0 text-primary' />
                      <span className='font-mono'>{workflow.repoFullName}</span>
                    </div>
                    <p className='font-mono text-xs text-muted-foreground/90'>{workflow.workflowPath}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default WorkflowTransferBox;
