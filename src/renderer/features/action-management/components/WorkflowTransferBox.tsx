import { useDeferredValue, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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

  const renderWorkflowTable = <T extends GitHubManagedWorkflowReference | GitHubWorkflowSummary>(options: {
    emptyState: string;
    rows: T[];
    selectedKeys: string[];
    setSelectedKeys: Dispatch<SetStateAction<string[]>>;
    onRowDoubleClick: (workflow: T) => void;
  }) => {
    const { emptyState, rows, selectedKeys, setSelectedKeys, onRowDoubleClick } = options;

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
            <th className='px-3 py-3 font-medium'>{t('repoList.columns.repository')}</th>
            <th className='hidden px-3 py-3 font-medium xl:table-cell'>{t('actionManagement.table.path')}</th>
            <th className='px-3 py-3 font-medium'>{t('actionManagement.table.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((workflow) => {
            const key = workflowKey(workflow);
            const checked = selectedKeys.includes(key);

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
                    onChange={() => {
                      setSelectedKeys((current) => (
                        checked ? current.filter((item) => item !== key) : [...current, key]
                      ));
                    }}
                  />
                </td>
                <td className='px-3 py-3 align-top'>
                  <p className='text-sm font-medium text-foreground'>{workflow.workflowName}</p>
                </td>
                <td className='px-3 py-3 align-top font-mono text-xs text-muted-foreground'>
                  {workflow.repoFullName}
                </td>
                <td className='hidden px-3 py-3 align-top font-mono text-xs text-muted-foreground/90 xl:table-cell'>
                  {workflow.workflowPath}
                </td>
                <td className='px-3 py-3 align-top'>
                  <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                    {workflow.supportsDispatch
                      ? t('actionManagement.card.dispatchReady')
                      : t('actionManagement.card.dispatchUnavailable')}
                  </Badge>
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('actionManagement.transfer.searchPlaceholder')}
              className='h-11 pl-10'
            />
          </div>
        </label>

        <div className='mt-4 min-h-0 flex-1 overflow-auto'>
          {renderWorkflowTable({
            emptyState: availableWorkflows.length === stagedWorkflows.length
              ? t('actionManagement.transfer.emptyAvailable')
              : t('actionManagement.transfer.noSearchResults'),
            rows: visibleAvailableWorkflows,
            selectedKeys: selectedAvailableKeys,
            setSelectedKeys: setSelectedAvailableKeys,
            onRowDoubleClick: (workflow) => onMoveToStaged([workflow]),
          })}
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

      <section className='editor-panel flex h-[18rem] min-h-0 flex-col overflow-hidden p-4 sm:h-[22rem] lg:h-[calc(80vh-20rem)]'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-foreground'>
              {t('actionManagement.transfer.selected', { count: stagedWorkflows.length })}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>{t('actionManagement.transfer.selectedHint')}</p>
          </div>
          <Badge variant='outline'>{stagedWorkflows.length}</Badge>
        </div>

        <div className='mt-4 min-h-0 flex-1 overflow-auto'>
          {renderWorkflowTable({
            emptyState: t('actionManagement.transfer.emptySelected'),
            rows: stagedWorkflows,
            selectedKeys: selectedStagedKeys,
            setSelectedKeys: setSelectedStagedKeys,
            onRowDoubleClick: (workflow) => onRemoveFromStaged([workflow]),
          })}
        </div>
      </section>
    </div>
  );
}

export default WorkflowTransferBox;
