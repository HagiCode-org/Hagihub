import { startTransition, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bolt,
  Cable,
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  Github,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  TriangleAlert,
  Users,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { AccountManagementPage, AddAccountDialog, EmptyState, RepoList, WorkspaceAccountEntry } from '@/features/github';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAppInfo } from '@/store/slices/hubSlice';
import {
  clearAccountsNotice,
  fetchAccounts,
  resetDeviceFlowState,
} from '@/store/slices/githubAccountsSlice';
import { clearActions, fetchActionsSummaries } from '@/store/slices/githubActionsSlice';
import { clearRepos, fetchRepos } from '@/store/slices/githubReposSlice';
import { setActiveSection, type NavigationSection } from '@/store/slices/navigationSlice';
import type { GitHubRepoActionsSummary } from '../../shared/api';

const repoUrl = 'https://github.com/HagiCode-org/Hagihub';
const RECENT_REPO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ActionChipState = GitHubRepoActionsSummary['state'] | 'loading';

const sectionDefinitions: Array<{
  id: NavigationSection;
  icon: typeof Layers3;
}> = [
  { id: 'overview', icon: Layers3 },
  { id: 'workspace', icon: FolderGit2 },
  { id: 'accounts', icon: Users },
  { id: 'settings', icon: Settings2 },
];

type RoadmapItem = {
  title: string;
};

function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ensureRoadmapItems(value: unknown): RoadmapItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RoadmapItem =>
          typeof item === 'object'
          && item !== null
          && typeof item.title === 'string',
      )
    : [];
}

function HubShell() {
  const { t, i18n } = useTranslation(['common', 'github']);
  const dispatch = useAppDispatch();
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const { appInfo, loadStatus } = useAppSelector((state) => state.hub);
  const activeSection = useAppSelector((state) => state.navigation.activeSection);
  const {
    accounts,
    activeAccountId,
    fetchStatus: accountsFetchStatus,
    error: accountsError,
    notice: accountsNotice,
  } = useAppSelector((state) => state.githubAccounts);
  const {
    orgs,
    repos,
    fetchStatus: reposFetchStatus,
  } = useAppSelector((state) => state.githubRepos);
  const {
    summariesByRepoFullName,
    fetchStatus: actionsFetchStatus,
    failedCount: actionsFailedCount,
    error: actionsError,
  } = useAppSelector((state) => state.githubActions);

  useEffect(() => {
    document.getElementById('loading-container')?.remove();

    if (loadStatus === 'idle') {
      void dispatch(fetchAppInfo());
    }
  }, [dispatch, loadStatus]);

  useEffect(() => {
    if (accountsFetchStatus === 'idle') {
      void dispatch(fetchAccounts());
    }
  }, [accountsFetchStatus, dispatch]);

  const isWorkspaceSection = activeSection === 'workspace';
  const isAccountsSection = activeSection === 'accounts';

  useEffect(() => {
    if (!isWorkspaceSection) {
      return;
    }

    if (!activeAccountId) {
      dispatch(clearRepos());
      return;
    }

    void dispatch(fetchRepos(activeAccountId));
  }, [activeAccountId, dispatch, isWorkspaceSection]);

  useEffect(() => {
    if (!isWorkspaceSection || !activeAccountId || reposFetchStatus !== 'succeeded' || repos.length === 0) {
      return;
    }

    void dispatch(fetchActionsSummaries({
      accountId: activeAccountId,
      repoFullNames: repos.map((repo) => repo.fullName),
    }));
  }, [activeAccountId, dispatch, isWorkspaceSection, repos, reposFetchStatus]);

  const sections = sectionDefinitions.map((section) => ({
    ...section,
    label: t(`navigation.sections.${section.id}.label`, { ns: 'common' }),
  }));

  const sectionMeta = sections.find((section) => section.id === activeSection) ?? sections[0];
  const foundationModules = ensureStringArray(t('shell.foundationModules', { ns: 'common', returnObjects: true }));
  const roadmapItems = ensureRoadmapItems(t(`shell.roadmap.${activeSection}`, { ns: 'common', returnObjects: true }));
  const nextSteps = ensureStringArray(t('shell.nextSteps', { ns: 'common', returnObjects: true }));
  const loadingLabel = t('shell.loading', { ns: 'common' });
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;
  const privateRepoCount = repos.filter((repo) => repo.isPrivate).length;
  const recentRepoCount = repos.filter((repo) => Date.now() - Date.parse(repo.updatedAt) <= RECENT_REPO_WINDOW_MS).length;
  const actionSummaries = Object.values(summariesByRepoFullName).filter(
    (summary): summary is GitHubRepoActionsSummary => summary !== undefined,
  );
  const runningActionCount = actionSummaries.filter((summary) => summary.state === 'running').length;
  const failedActionCount = actionSummaries.filter((summary) => summary.state === 'failed' || summary.state === 'error').length;
  const passedActionCount = actionSummaries.filter((summary) => summary.state === 'passed').length;
  const noRunsCount = actionSummaries.filter((summary) => summary.state === 'empty').length;
  const recentActionRuns = actionSummaries
    .filter((summary): summary is GitHubRepoActionsSummary & { latestRun: NonNullable<GitHubRepoActionsSummary['latestRun']> } => summary.latestRun !== null)
    .sort((left, right) => Date.parse(right.latestRun.updatedAt) - Date.parse(left.latestRun.updatedAt))
    .slice(0, 5);

  const openAddAccountDialog = () => {
    dispatch(resetDeviceFlowState());
    setIsAddAccountOpen(true);
  };

  const closeAddAccountDialog = () => {
    setIsAddAccountOpen(false);
  };

  const refreshWorkspace = () => {
    if (activeAccountId) {
      void dispatch(fetchRepos(activeAccountId));
      return;
    }

    void dispatch(fetchAccounts());
  };

  const workspaceSummary = [
    t('workspace.accountCount', { ns: 'github', count: accounts.length }),
    t('workspace.orgCount', { ns: 'github', count: orgs.length }),
    t('workspace.repoCount', { ns: 'github', count: repos.length }),
  ];

  const actionSummaryChips = [
    t('workspace.runningCount', { ns: 'github', count: runningActionCount }),
    t('workspace.failedCount', { ns: 'github', count: failedActionCount }),
    t('workspace.passedCount', { ns: 'github', count: passedActionCount }),
  ];

  const getActionChipMeta = (state: ActionChipState) => {
    if (state === 'loading') {
      return {
        label: t('repoCard.state.loading', { ns: 'github' }),
        className: 'border-sky-400/20 bg-sky-300/8 text-sky-100',
        icon: <LoaderCircle className="size-3.5 animate-spin" />,
      };
    }

    if (state === 'running') {
      return {
        label: t('repoCard.state.running', { ns: 'github' }),
        className: 'border-amber-400/25 bg-amber-300/10 text-amber-100',
        icon: <Workflow className="size-3.5" />,
      };
    }

    if (state === 'passed') {
      return {
        label: t('repoCard.state.passed', { ns: 'github' }),
        className: 'border-emerald-400/25 bg-emerald-300/10 text-emerald-100',
        icon: <CheckCircle2 className="size-3.5" />,
      };
    }

    if (state === 'failed' || state === 'error') {
      return {
        label: t(`repoCard.state.${state}`, { ns: 'github' }),
        className: 'border-red-400/25 bg-red-300/10 text-red-100',
        icon: <TriangleAlert className="size-3.5" />,
      };
    }

    return {
      label: t('repoCard.state.empty', { ns: 'github' }),
      className: 'border-border/70 bg-background/45 text-muted-foreground',
      icon: <Workflow className="size-3.5" />,
    };
  };

  const renderOverviewContent = () => (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t('shell.foundationBadge', { ns: 'common' })}</Badge>
          <Badge variant={loadStatus === 'failed' ? 'outline' : 'secondary'}>
            {loadStatus === 'loading'
              ? t('shell.loadingRuntime', { ns: 'common' })
              : loadStatus === 'failed'
                ? t('shell.runtimeUnavailable', { ns: 'common' })
                : t('shell.runtimeConnected', { ns: 'common' })}
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            {t('shell.prepareTitle', { ns: 'common' })}
          </h2>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.rendererStackLabel', { ns: 'common' })}</p>
            <p className="mt-3 text-lg font-medium text-foreground">{t('shell.rendererStackValue', { ns: 'common' })}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.appModeLabel', { ns: 'common' })}</p>
            <p className="mt-3 text-lg font-medium text-foreground">
              {appInfo?.isPackaged ? t('shell.appModePackaged', { ns: 'common' }) : t('shell.appModeDevelopment', { ns: 'common' })}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{appInfo ? `v${appInfo.appVersion}` : loadingLabel}</p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.electronLabel', { ns: 'common' })}</p>
            <p className="mt-3 text-lg font-medium text-foreground">{appInfo?.electronVersion ?? loadingLabel}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{appInfo?.platform ?? loadingLabel}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <section className="editor-panel p-5 lg:p-6">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <TerminalSquare className="size-4 text-primary" />
            {t('shell.foundationModulesLabel', { ns: 'common' })}
          </div>
          <div className="mt-4 space-y-3">
            {foundationModules.map((module) => (
              <div key={module} className="list-row px-4 py-3 text-sm leading-6 text-foreground/92">
                {module}
              </div>
            ))}
          </div>
        </section>

        <section className="editor-panel p-5 lg:p-6">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Bolt className="size-4 text-primary" />
            {t('shell.suggestedNextSteps', { ns: 'common' })}
          </div>
          <div className="mt-4 space-y-3">
            {roadmapItems.map((item) => (
              <div key={item.title} className="panel-muted p-4">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  const renderSettingsContent = () => (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{sectionMeta.label}</Badge>
          <Badge variant="outline">{t('shell.runtimeSnapshot', { ns: 'common' })}</Badge>
        </div>
        <div className="mt-4 space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">{sectionMeta.label}</h2>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <section className="editor-panel p-5 lg:p-6">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Cable className="size-4 text-primary" />
            {t('shell.suggestedNextSteps', { ns: 'common' })}
          </div>
          <div className="mt-4 space-y-3">
            {roadmapItems.map((item) => (
              <div key={item.title} className="list-row px-4 py-3">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="editor-panel p-5 lg:p-6">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            {t('shell.foundationModulesLabel', { ns: 'common' })}
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            {nextSteps.map((step) => (
              <div key={step} className="panel-muted px-4 py-3">
                {step}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  const renderWorkspaceContent = () => {
    if (accountsFetchStatus === 'loading' && accounts.length === 0) {
      return (
        <section className="editor-panel px-6 py-12 text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-base font-medium text-foreground">{t('workspace.loadingAccounts', { ns: 'github' })}</p>
        </section>
      );
    }

    if (accountsFetchStatus === 'failed') {
      return (
        <section className="editor-panel border-destructive/30 bg-destructive/6 px-6 py-8">
          <p className="text-base font-semibold text-destructive">{t('workspace.loadAccountsFailedTitle', { ns: 'github' })}</p>
          <p className="mt-2 text-sm leading-7 text-destructive/90">{accountsError}</p>
          <Button className="mt-5" variant="outline" onClick={() => void dispatch(fetchAccounts())}>
            <RefreshCw /> {t('workspace.retry', { ns: 'github' })}
          </Button>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <section className="editor-panel p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{t('workspace.heroBadge', { ns: 'github' })}</Badge>
                <Badge variant="secondary">
                  {actionsFetchStatus === 'loading'
                    ? t('workspace.actionsScanning', { ns: 'github' })
                    : actionsFetchStatus === 'failed'
                      ? t('workspace.actionsUnavailable', { ns: 'github' })
                      : t('workspace.actionsSynced', { ns: 'github' })}
                </Badge>
              </div>
              <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                {t('workspace.heroTitle', { ns: 'github' })}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={openAddAccountDialog}>
                <Plus /> {t('workspace.addAccount', { ns: 'github' })}
              </Button>
              <Button variant="outline" onClick={refreshWorkspace}>
                <RefreshCw /> {t('workspace.refreshRepos', { ns: 'github' })}
              </Button>
            </div>
          </div>

          {accountsNotice ? (
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100/88">
              <div className="flex items-start justify-between gap-4">
                <span>{accountsNotice}</span>
                <button
                  type="button"
                  className="shrink-0 text-amber-50/85 transition hover:text-amber-50"
                  onClick={() => dispatch(clearAccountsNotice())}
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          {actionsError ? (
            <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm leading-6 text-destructive/92">
              {actionsError}
            </div>
          ) : null}
        </section>

        {accounts.length === 0 ? (
          <EmptyState onAddAccount={openAddAccountDialog} />
        ) : (
          <>
            <WorkspaceAccountEntry onAddAccount={openAddAccountDialog} />
            {activeAccountId ? <RepoList activeAccountId={activeAccountId} /> : null}
          </>
        )}
      </div>
    );
  };

  const renderAccountsContent = () => (
    <AccountManagementPage onAddAccount={openAddAccountDialog} />
  );

  const renderInspector = () => (
    <>
      <section className="editor-panel p-4">
        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
          <TerminalSquare className="size-4 text-primary" />
          {t('shell.runtimeSnapshot', { ns: 'common' })}
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('shell.info.channel', { ns: 'common' })}</dt>
            <dd className="font-mono text-xs text-foreground">
              {appInfo ? t(`shell.buildChannel.${appInfo.buildChannel}`, { ns: 'common' }) : loadingLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('shell.info.platform', { ns: 'common' })}</dt>
            <dd className="font-mono text-xs text-foreground">{appInfo?.platform ?? loadingLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('shell.info.version', { ns: 'common' })}</dt>
            <dd className="font-mono text-xs text-foreground">{appInfo ? `v${appInfo.appVersion}` : loadingLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('shell.info.node', { ns: 'common' })}</dt>
            <dd className="font-mono text-xs text-foreground">{appInfo?.nodeVersion ?? loadingLabel}</dd>
          </div>
        </dl>
      </section>

      {isWorkspaceSection ? (
        <section className="editor-panel p-4">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Github className="size-4 text-primary" />
            {t('workspace.actionsHintTitle', { ns: 'github' })}
          </div>

          <div className="mt-4 space-y-3">
            <div className="panel-muted p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.activeSectionLabel', { ns: 'common' })}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{sectionMeta.label}</p>
            </div>

            {activeAccount ? (
              <div className="list-row px-3 py-3">
                <div className="flex items-center gap-3">
                  <img src={activeAccount.avatarUrl} alt={activeAccount.login} className="size-10 rounded-xl border border-border/70 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">@{activeAccount.login}</p>
                    <p className="truncate text-xs text-muted-foreground">{activeAccount.name ?? t('deviceFlow.githubUser', { ns: 'github' })}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel-muted px-3 py-3 text-sm leading-6 text-muted-foreground">
                {t('emptyState.addFirst', { ns: 'github' })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.running', { ns: 'github' })}</p>
                <p className="mt-2 font-mono text-lg text-foreground">{runningActionCount}</p>
              </div>
              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.failed', { ns: 'github' })}</p>
                <p className="mt-2 font-mono text-lg text-foreground">{failedActionCount}</p>
              </div>
              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.passed', { ns: 'github' })}</p>
                <p className="mt-2 font-mono text-lg text-foreground">{passedActionCount}</p>
              </div>
              <div className="panel-muted p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.updated', { ns: 'github' })}</p>
                <p className="mt-2 font-mono text-lg text-foreground">{recentRepoCount}</p>
              </div>
            </div>

            {actionsFetchStatus === 'loading' ? (
              <p className="text-sm leading-6 text-muted-foreground">{t('workspace.actionsHintLoading', { ns: 'github' })}</p>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">{t('workspace.actionsHint', { ns: 'github' })}</p>
            )}

            {actionsFailedCount > 0 ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-300/8 px-3 py-3 text-sm leading-6 text-amber-100/88">
                {t('workspace.actionsHintPartial', { ns: 'github', count: actionsFailedCount })}
              </div>
            ) : null}

            <div className="panel-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('workspace.recentRunsTitle', { ns: 'github' })}</p>
                <span className="font-mono text-[11px] text-muted-foreground">{t('workspace.noRunsCount', { ns: 'github', count: noRunsCount })}</span>
              </div>

              <div className="mt-3 space-y-3">
                {recentActionRuns.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">{t('workspace.recentRunsEmpty', { ns: 'github' })}</p>
                ) : recentActionRuns.map((summary) => {
                  const meta = getActionChipMeta(summary.state);
                  const latestRun = summary.latestRun;
                  const updatedAt = new Date(latestRun.updatedAt).toLocaleString(i18n.resolvedLanguage ?? i18n.language, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={latestRun.id} className="list-row px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{summary.repoFullName}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{`${latestRun.workflowName} #${latestRun.runNumber}`}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{t('repoCard.triggeredBy', { ns: 'github', event: latestRun.event })}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => void window.hagihub.openExternal(latestRun.htmlUrl)}>
                          <ArrowUpRight />
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium', meta.className)}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{updatedAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="editor-panel p-4">
        <div className="flex items-center gap-3 text-sm font-medium text-foreground">
          <Bolt className="size-4 text-primary" />
          {t('shell.suggestedNextSteps', { ns: 'common' })}
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
          {roadmapItems.map((item) => (
            <div key={item.title} className="panel-muted px-3 py-3">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(232,182,96,0.09),transparent_26%),radial-gradient(circle_at_88%_10%,rgba(92,136,194,0.12),transparent_18%),linear-gradient(180deg,rgba(10,13,20,0.24),transparent_26%)]" />

        <header className="relative z-10 border-b border-border/70 bg-[var(--surface-chrome)]/92 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-primary/10 font-mono text-sm font-semibold text-primary">
                HH
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{t('app.name', { ns: 'common' })}</p>
                  <Badge variant="outline">{t('shell.chromeBadge', { ns: 'common' })}</Badge>
                  <Badge variant="secondary">{sectionMeta.label}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {sectionMeta.label}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void window.hagihub.openExternal(repoUrl)}>
                <ExternalLink /> {t('shell.openRepository', { ns: 'common' })}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void dispatch(fetchAppInfo())}>
                <RefreshCw /> {t('shell.refreshRuntime', { ns: 'common' })}
              </Button>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1">
          <aside className="hidden border-r border-border/70 bg-[var(--surface-activity)]/94 md:flex md:w-[4.5rem] md:flex-col md:items-center md:justify-between md:px-2 md:py-3">
            <div className="flex w-full flex-col gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;

                return (
                  <button
                    key={section.id}
                    type="button"
                    className={cn(
                      'flex h-12 w-full items-center justify-center rounded-xl border transition-colors',
                      isActive
                        ? 'border-primary/30 bg-primary/12 text-primary'
                        : 'border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/45 hover:text-accent-foreground',
                    )}
                    aria-label={section.label}
                    onClick={() => {
                      startTransition(() => {
                        dispatch(setActiveSection(section.id));
                      });
                    }}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border/70 bg-background/45 px-2 py-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{loadStatus === 'failed' ? 'OFF' : 'ON'}</p>
            </div>
          </aside>

          <aside className="hidden min-h-0 w-72 shrink-0 overflow-y-auto border-r border-border/70 bg-[var(--surface-sidebar)]/90 p-3 xl:flex xl:flex-col xl:gap-4">
            <section className="editor-panel p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('shell.navigationLabel', { ns: 'common' })}</p>
              <nav className="mt-4 space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                        isActive
                          ? 'border-primary/30 bg-primary/10 text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/45 hover:text-accent-foreground',
                      )}
                      onClick={() => {
                        startTransition(() => {
                          dispatch(setActiveSection(section.id));
                        });
                      }}
                    >
                      <span className={cn('rounded-lg border p-2', isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background/45')}>
                        <Icon className="size-4" />
                      </span>
                      <span className="space-y-1">
                        <span className="block text-sm font-medium">{section.label}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </section>

            <section className="editor-panel p-4">
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                {t('shell.runtimeSnapshot', { ns: 'common' })}
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('shell.info.channel', { ns: 'common' })}</dt>
                  <dd className="font-mono text-xs text-foreground">
                    {appInfo ? t(`shell.buildChannel.${appInfo.buildChannel}`, { ns: 'common' }) : loadingLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('shell.info.version', { ns: 'common' })}</dt>
                  <dd className="font-mono text-xs text-foreground">{appInfo ? `v${appInfo.appVersion}` : loadingLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('shell.info.platform', { ns: 'common' })}</dt>
                  <dd className="font-mono text-xs text-foreground">{appInfo?.platform ?? loadingLabel}</dd>
                </div>
              </dl>
            </section>

            {isWorkspaceSection ? (
              <section className="editor-panel p-4">
                <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <Github className="size-4 text-primary" />
                  {t('workspace.actionsHintTitle', { ns: 'github' })}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="panel-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.repos', { ns: 'github' })}</p>
                    <p className="mt-2 font-mono text-lg text-foreground">{repos.length}</p>
                  </div>
                  <div className="panel-muted p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoList.metrics.private', { ns: 'github' })}</p>
                    <p className="mt-2 font-mono text-lg text-foreground">{privateRepoCount}</p>
                  </div>
                </div>
              </section>
            ) : null}
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border/70 bg-[var(--surface-toolbar)]/88 px-3 py-2 xl:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sections.map((section) => {
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={cn(
                        'shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/70 bg-background/35 text-muted-foreground hover:bg-accent/45 hover:text-accent-foreground',
                      )}
                      onClick={() => {
                        startTransition(() => {
                          dispatch(setActiveSection(section.id));
                        });
                      }}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-h-0 overflow-y-auto px-4 py-4 lg:px-5 lg:py-5">
                {activeSection === 'overview' ? renderOverviewContent() : null}
                {isWorkspaceSection ? renderWorkspaceContent() : null}
                {isAccountsSection ? renderAccountsContent() : null}
                {activeSection === 'settings' ? renderSettingsContent() : null}
              </section>

              <aside className="hidden min-h-0 flex-col gap-4 border-l border-border/70 bg-[var(--surface-sidebar)]/72 p-4 xl:flex xl:overflow-y-auto">
                {renderInspector()}
              </aside>
            </div>
          </main>
        </div>

        <footer className="relative z-10 border-t border-border/70 bg-[var(--surface-chrome)]/92 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="font-mono">{t('shell.statusBar.section', { ns: 'common' })}: {sectionMeta.label}</span>
            <span className="font-mono">{t('shell.statusBar.account', { ns: 'common' })}: {activeAccount ? `@${activeAccount.login}` : t('shell.statusBar.none', { ns: 'common' })}</span>
            <span className="font-mono">{t('shell.statusBar.repos', { ns: 'common' })}: {repos.length}</span>
            <span className="font-mono">{t('shell.statusBar.orgs', { ns: 'common' })}: {orgs.length}</span>
            <span className="font-mono">{t('workspace.runningCount', { ns: 'github', count: runningActionCount })}</span>
            <span className="font-mono">{t('workspace.failedCount', { ns: 'github', count: failedActionCount })}</span>
            <span className="font-mono">{t('workspace.passedCount', { ns: 'github', count: passedActionCount })}</span>
            <span className="font-mono">{t('shell.statusBar.runtime', { ns: 'common' })}: {loadStatus === 'failed' ? t('shell.runtimeUnavailable', { ns: 'common' }) : t('shell.statusBar.ready', { ns: 'common' })}</span>
          </div>
        </footer>
      </div>

      <AddAccountDialog open={isAddAccountOpen} onClose={closeAddAccountDialog} />
    </div>
  );
}

export default HubShell;
