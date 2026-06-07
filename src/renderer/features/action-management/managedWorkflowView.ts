import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { GitHubManagedWorkflow } from '../../../shared/api';

interface ManagedWorkflowStatusMeta {
  className: string;
  icon: LucideIcon;
  label: string;
  spin?: boolean;
}

interface ManagedWorkflowViewModel {
  defaultBranchLabel: string | null;
  latestRunMeta: string | null;
  latestRunTitle: string | null;
  statusMeta: ManagedWorkflowStatusMeta;
  updatedAtLabel: string;
}

function formatManagedWorkflowDate(value: string | null, locale: string): string {
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

function getManagedWorkflowStatusMeta(
  t: TFunction<'github'>,
  latestRunState: GitHubManagedWorkflow['latestRunState'],
): ManagedWorkflowStatusMeta {
  if (latestRunState === 'success') {
    return { icon: CheckCircle2, className: 'text-emerald-400', label: t('actionManagement.state.success') };
  }

  if (latestRunState === 'failure') {
    return { icon: XCircle, className: 'text-rose-400', label: t('actionManagement.state.failure') };
  }

  if (latestRunState === 'in_progress') {
    return {
      icon: LoaderCircle,
      className: 'text-sky-400',
      label: t('actionManagement.state.inProgress'),
      spin: true,
    };
  }

  if (latestRunState === 'waiting') {
    return { icon: Clock3, className: 'text-amber-300', label: t('actionManagement.state.waiting') };
  }

  if (latestRunState === 'unavailable') {
    return { icon: RefreshCw, className: 'text-muted-foreground', label: t('actionManagement.state.unavailable') };
  }

  return { icon: AlertCircle, className: 'text-destructive', label: t('actionManagement.state.error') };
}

export function buildManagedWorkflowViewModel(
  t: TFunction<'github'>,
  workflow: GitHubManagedWorkflow,
  locale: string,
): ManagedWorkflowViewModel {
  return {
    defaultBranchLabel: workflow.defaultBranch ?? null,
    latestRunMeta: workflow.latestRun
      ? workflow.latestRun.branch
        ? `${workflow.latestRun.event} / ${workflow.latestRun.branch}`
        : workflow.latestRun.event
      : null,
    latestRunTitle: workflow.latestRun?.displayTitle ?? null,
    statusMeta: getManagedWorkflowStatusMeta(t, workflow.latestRunState),
    updatedAtLabel: formatManagedWorkflowDate(workflow.lastScannedAt ?? workflow.latestRun?.updatedAt ?? null, locale),
  };
}
