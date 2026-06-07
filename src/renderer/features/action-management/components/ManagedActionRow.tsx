import {
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { buildManagedWorkflowViewModel } from '../managedWorkflowView';
import {
  openDispatchDialog,
  removeManagedWorkflowForActiveAccount,
  toggleMonitoringForActiveAccount,
} from '@/store/slices/actionManagementSlice';
import type { GitHubManagedWorkflow } from '../../../../shared/api';

interface ManagedActionRowProps {
  workflow: GitHubManagedWorkflow;
}

function ManagedActionRow({ workflow }: ManagedActionRowProps) {
  const { t, i18n } = useTranslation('github');
  const dispatch = useAppDispatch();
  const removing = useAppSelector((state) => state.actionManagement.persistStatus === 'loading');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isMonitored = workflow.monitored === true;
  const { defaultBranchLabel, latestRunMeta, latestRunTitle, statusMeta, updatedAtLabel } = buildManagedWorkflowViewModel(t, workflow, locale);
  const StatusIcon = statusMeta.icon;

  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`size-4 shrink-0 ${statusMeta.spin ? `${statusMeta.className} animate-spin` : statusMeta.className}`} />
          <span className="text-sm">{statusMeta.label}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{workflow.workflowName}</span>
            <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'} className="text-[10px]">
              {workflow.supportsDispatch
                ? t('actionManagement.card.dispatchReady')
                : t('actionManagement.card.dispatchUnavailable')}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Workflow className="size-3 shrink-0 text-primary" />
            <span className="font-mono">{workflow.repoFullName}</span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <p className="font-mono text-xs text-muted-foreground">{workflow.workflowPath}</p>
      </td>
      <td className="hidden px-4 py-3 xl:table-cell">
        {latestRunTitle ? (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{latestRunTitle}</p>
            <p className="text-xs text-muted-foreground">{latestRunMeta}</p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('actionManagement.card.noRun')}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 xl:table-cell">
        <div className="space-y-1">
          <p className="text-sm text-foreground">{updatedAtLabel}</p>
          {defaultBranchLabel && (
            <p className="font-mono text-xs text-muted-foreground">{defaultBranchLabel}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {workflow.supportsDispatch && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => dispatch(openDispatchDialog(workflow))}
              title={t('actionManagement.card.runWorkflow')}
            >
              <Play className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`size-8 ${isMonitored ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            disabled={removing}
            onClick={() => {
              void dispatch(toggleMonitoringForActiveAccount({
                repoFullName: workflow.repoFullName,
                workflowId: workflow.workflowId,
              }));
            }}
            title={isMonitored
              ? t('actionManagement.actionMonitoring.toggle.stop')
              : t('actionManagement.actionMonitoring.toggle.start')}
            aria-label={isMonitored
              ? t('actionManagement.actionMonitoring.toggle.stop')
              : t('actionManagement.actionMonitoring.toggle.start')}
          >
            {isMonitored
              ? <Eye className="size-3.5 fill-current" />
              : <EyeOff className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              void window.hagihub.openExternal(workflow.workflowHtmlUrl);
            }}
            title={t('actionManagement.card.openGithub')}
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            disabled={removing}
            onClick={() => {
              void dispatch(removeManagedWorkflowForActiveAccount({
                repoFullName: workflow.repoFullName,
                workflowId: workflow.workflowId,
              }));
            }}
            title={t('actionManagement.card.remove')}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default ManagedActionRow;
