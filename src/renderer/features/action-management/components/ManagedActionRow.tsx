import {
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  ExternalLink,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
  AlertCircle,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitHubManagedWorkflow } from '../../../../shared/api';

interface ManagedActionRowProps {
  workflow: GitHubManagedWorkflow;
  removing: boolean;
  onDispatch: (workflow: GitHubManagedWorkflow) => void;
  onToggleMonitoring: (workflow: GitHubManagedWorkflow) => void;
  onOpenExternal: (url: string) => void;
  onRemove: (workflow: GitHubManagedWorkflow) => void;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ManagedActionRow({ workflow, removing, onDispatch, onToggleMonitoring, onOpenExternal, onRemove }: ManagedActionRowProps) {
  const { t, i18n } = useTranslation('github');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const isMonitored = workflow.monitored === true;
  const statusMeta = workflow.latestRunState === 'success'
    ? { icon: CheckCircle2, className: 'text-emerald-400', label: t('actionManagement.state.success') }
    : workflow.latestRunState === 'failure'
      ? { icon: XCircle, className: 'text-rose-400', label: t('actionManagement.state.failure') }
      : workflow.latestRunState === 'in_progress'
        ? { icon: LoaderCircle, className: 'text-sky-400', label: t('actionManagement.state.inProgress'), spin: true }
        : workflow.latestRunState === 'waiting'
          ? { icon: Clock3, className: 'text-amber-300', label: t('actionManagement.state.waiting') }
          : workflow.latestRunState === 'unavailable'
            ? { icon: RefreshCw, className: 'text-muted-foreground', label: t('actionManagement.state.unavailable') }
            : { icon: AlertCircle, className: 'text-destructive', label: t('actionManagement.state.error') };
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
        {workflow.latestRun ? (
          <div className="space-y-1">
            <p className="text-sm text-foreground">{workflow.latestRun.displayTitle}</p>
            <p className="text-xs text-muted-foreground">
              {workflow.latestRun.event}
              {workflow.latestRun.branch ? ` / ${workflow.latestRun.branch}` : ''}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('actionManagement.card.noRun')}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 xl:table-cell">
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            {formatDate(workflow.lastScannedAt ?? workflow.latestRun?.updatedAt ?? null, locale)}
          </p>
          {workflow.defaultBranch && (
            <p className="font-mono text-xs text-muted-foreground">{workflow.defaultBranch}</p>
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
              onClick={() => onDispatch(workflow)}
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
            onClick={() => onToggleMonitoring(workflow)}
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
            onClick={() => onOpenExternal(workflow.workflowHtmlUrl)}
            title={t('actionManagement.card.openGithub')}
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            disabled={removing}
            onClick={() => onRemove(workflow)}
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
