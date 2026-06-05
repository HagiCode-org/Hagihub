import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GitHubManagedWorkflow } from '../../../../shared/api';

interface ManagedActionCardProps {
  workflow: GitHubManagedWorkflow;
  removing: boolean;
  onDispatch: (workflow: GitHubManagedWorkflow) => void;
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

function ManagedActionCard({ workflow, removing, onDispatch, onOpenExternal, onRemove }: ManagedActionCardProps) {
  const { t, i18n } = useTranslation('github');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const statusMeta = workflow.latestRunState === 'success'
    ? { icon: CheckCircle2, className: 'text-emerald-300', label: t('actionManagement.state.success') }
    : workflow.latestRunState === 'failure'
      ? { icon: XCircle, className: 'text-rose-300', label: t('actionManagement.state.failure') }
      : workflow.latestRunState === 'in_progress'
        ? { icon: LoaderCircle, className: 'text-sky-300', label: t('actionManagement.state.inProgress'), spin: true }
        : workflow.latestRunState === 'waiting'
          ? { icon: Clock3, className: 'text-amber-200', label: t('actionManagement.state.waiting') }
          : workflow.latestRunState === 'unavailable'
            ? { icon: RefreshCw, className: 'text-muted-foreground', label: t('actionManagement.state.unavailable') }
            : { icon: AlertCircle, className: 'text-destructive', label: t('actionManagement.state.error') };
  const StatusIcon = statusMeta.icon;

  return (
    <Card className="rounded-[1.6rem] bg-[var(--surface-panel)]/88">
      <CardHeader className="gap-4 border-b border-border/70 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base text-foreground">{workflow.workflowName}</CardTitle>
              <Badge variant={workflow.supportsDispatch ? 'default' : 'outline'}>
                {workflow.supportsDispatch
                  ? t('actionManagement.card.dispatchReady')
                  : t('actionManagement.card.dispatchUnavailable')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Workflow className="size-3.5 shrink-0 text-primary" />
              <span className="font-mono">{workflow.repoFullName}</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground/80">{workflow.workflowPath}</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <StatusIcon className={statusMeta.spin ? `${statusMeta.className} animate-spin` : statusMeta.className} />
            <span>{statusMeta.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.card.latestRun')}</p>
            {workflow.latestRun ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-foreground">{workflow.latestRun.displayTitle}</p>
                <p className="text-xs text-muted-foreground">{t('actionManagement.card.latestRunMeta', {
                  event: workflow.latestRun.event,
                  branch: workflow.latestRun.branch ?? t('actionManagement.card.unknownBranch'),
                })}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t('actionManagement.card.noRun')}</p>
            )}
          </div>

          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.card.updated')}</p>
            <p className="mt-3 text-sm font-medium text-foreground">{formatDate(workflow.lastScannedAt ?? workflow.latestRun?.updatedAt ?? null, locale)}</p>
            {workflow.defaultBranch ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">{t('actionManagement.card.defaultBranch', { branch: workflow.defaultBranch })}</p>
            ) : null}
          </div>
        </div>

        {workflow.refreshError ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {workflow.refreshError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {workflow.supportsDispatch ? (
            <Button size="sm" onClick={() => onDispatch(workflow)}>
              <Play />
              {t('actionManagement.card.runWorkflow')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => onOpenExternal(workflow.workflowHtmlUrl)}>
            <ExternalLink />
            {t('actionManagement.card.openGithub')}
          </Button>
          <Button variant="outline" size="sm" disabled={removing} onClick={() => onRemove(workflow)}>
            <Trash2 />
            {t('actionManagement.card.remove')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ManagedActionCard;
