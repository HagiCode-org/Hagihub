import { startTransition, useEffect, useState } from 'react';
import {
  Bolt,
  Cable,
  Check,
  ChevronsUpDown,
  ExternalLink,
  FolderGit2,
  Layers3,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Users,
  Workflow,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ActionManagementPage } from '@/features/action-management';
import { AccountManagementPage, AddAccountDialog, EmptyState, RepoList } from '@/features/github';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAppInfo } from '@/store/slices/hubSlice';
import {
  clearAccountsNotice,
  fetchAccounts,
  resetDeviceFlowState,
  switchAccount,
} from '@/store/slices/githubAccountsSlice';
import { clearRepos, fetchRepos } from '@/store/slices/githubReposSlice';
import { setActiveSection, toggleSidebarCollapsed, type NavigationSection } from '@/store/slices/navigationSlice';

const repoUrl = 'https://github.com/HagiCode-org/Hagihub';

const sectionDefinitions: Array<{
  id: NavigationSection;
  icon: typeof Layers3;
}> = [
  { id: 'overview', icon: Layers3 },
  { id: 'repos', icon: FolderGit2 },
  { id: 'actions', icon: Workflow },
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
  const { t } = useTranslation(['common', 'github']);
  const dispatch = useAppDispatch();
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const { appInfo, loadStatus } = useAppSelector((state) => state.hub);
  const activeSection = useAppSelector((state) => state.navigation.activeSection);
  const sidebarCollapsed = useAppSelector((state) => state.navigation.sidebarCollapsed);
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

  const isReposSection = activeSection === 'repos';
  const isActionsSection = activeSection === 'actions';
  const isAccountsSection = activeSection === 'accounts';

  useEffect(() => {
    if (!isReposSection) {
      return;
    }

    if (!activeAccountId) {
      dispatch(clearRepos());
      return;
    }

    void dispatch(fetchRepos(activeAccountId));
  }, [activeAccountId, dispatch, isReposSection]);

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

  const openAddAccountDialog = () => {
    dispatch(resetDeviceFlowState());
    setIsAddAccountOpen(true);
  };

  const closeAddAccountDialog = () => {
    setIsAddAccountOpen(false);
  };

  const refreshRepos = () => {
    if (activeAccountId) {
      void dispatch(fetchRepos(activeAccountId));
      return;
    }

    void dispatch(fetchAccounts());
  };

  const handleSwitchAccount = (accountId: string) => {
    void dispatch(switchAccount(accountId));
    setIsAccountDropdownOpen(false);
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

  const renderAccountDropdown = () => {
    if (accounts.length === 0) {
      return (
        <Button variant="outline" size="sm" onClick={openAddAccountDialog}>
          <Plus /> {t('repos.addAccount', { ns: 'github' })}
        </Button>
      );
    }

    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
        >
          {activeAccount ? (
            <>
              <img src={activeAccount.avatarUrl} alt={activeAccount.login} className="size-5 rounded-md border border-border/70 object-cover" />
              <span className="truncate max-w-[120px]">@{activeAccount.login}</span>
            </>
          ) : (
            <span>{t('reposAccountEntry.selectAccount', { ns: 'github' })}</span>
          )}
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>

        {isAccountDropdownOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsAccountDropdownOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border/70 bg-[var(--surface-panel)]/98 shadow-xl backdrop-blur-xl">
              <div className="p-1.5">
                {accounts.map((account) => {
                  const isActive = account.id === activeAccountId;

                  return (
                    <button
                      key={account.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        isActive
                          ? 'bg-primary/10 text-foreground'
                          : 'text-muted-foreground hover:bg-accent/45 hover:text-accent-foreground',
                      )}
                      onClick={() => handleSwitchAccount(account.id)}
                    >
                      <img src={account.avatarUrl} alt={account.login} className="size-8 rounded-lg border border-border/70 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">@{account.login}</p>
                        <p className="truncate text-xs text-muted-foreground">{account.name ?? t('deviceFlow.githubUser', { ns: 'github' })}</p>
                      </div>
                      {isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/70 p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/45 hover:text-accent-foreground"
                  onClick={() => {
                    setIsAccountDropdownOpen(false);
                    openAddAccountDialog();
                  }}
                >
                  <Plus className="size-4" />
                  {t('repos.addAccount', { ns: 'github' })}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  const renderReposContent = () => {
    if (accountsFetchStatus === 'loading' && accounts.length === 0) {
      return (
        <section className="editor-panel px-6 py-12 text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-base font-medium text-foreground">{t('repos.loadingAccounts', { ns: 'github' })}</p>
        </section>
      );
    }

    if (accountsFetchStatus === 'failed') {
      return (
        <section className="editor-panel border-destructive/30 bg-destructive/6 px-6 py-8">
          <p className="text-base font-semibold text-destructive">{t('repos.loadAccountsFailedTitle', { ns: 'github' })}</p>
          <p className="mt-2 text-sm leading-7 text-destructive/90">{accountsError}</p>
          <Button className="mt-5" variant="outline" onClick={() => void dispatch(fetchAccounts())}>
            <RefreshCw /> {t('repos.retry', { ns: 'github' })}
          </Button>
        </section>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
        <section className="editor-panel p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge>{t('repoList.eyebrow', { ns: 'github' })}</Badge>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {t('repoList.title', { ns: 'github' })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('repoList.description', { ns: 'github' })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {renderAccountDropdown()}
              <Button variant="outline" size="sm" onClick={refreshRepos}>
                <RefreshCw /> {t('repos.refreshRepos', { ns: 'github' })}
              </Button>
            </div>
          </div>

          {accountsNotice ? (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-300/8 px-4 py-3 text-sm leading-6 text-amber-100/88">
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
        </section>

        {accounts.length === 0 ? (
          <EmptyState onAddAccount={openAddAccountDialog} />
        ) : (
          activeAccountId ? <RepoList activeAccountId={activeAccountId} /> : null
        )}
      </div>
    );
  };

  const renderAccountsContent = () => (
    <AccountManagementPage onAddAccount={openAddAccountDialog} />
  );

  const renderActionsContent = () => (
    <ActionManagementPage
      onAddAccount={openAddAccountDialog}
      onOpenAccounts={() => {
        startTransition(() => {
          dispatch(setActiveSection('accounts'));
        });
      }}
    />
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative flex h-screen flex-col overflow-hidden">
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
          <aside
            className={cn(
              'hidden min-h-0 shrink-0 overflow-y-auto border-r border-border/70 bg-[var(--surface-sidebar)]/90 transition-[width] duration-200 ease-out md:flex md:flex-col md:gap-4',
              sidebarCollapsed ? 'w-[4.5rem] px-2 py-3' : 'w-56 p-3',
            )}
          >
            <section className="editor-panel p-4">
              <div className="flex items-center justify-between">
                {!sidebarCollapsed && (
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('shell.navigationLabel', { ns: 'common' })}</p>
                )}
                <button
                  type="button"
                  className={cn(
                    'rounded-lg border border-border/70 p-1.5 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-accent-foreground',
                    sidebarCollapsed ? 'mx-auto' : 'ml-auto',
                  )}
                  aria-label={sidebarCollapsed ? t('shell.expandSidebar', { ns: 'common' }) : t('shell.collapseSidebar', { ns: 'common' })}
                  onClick={() => dispatch(toggleSidebarCollapsed())}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
              </div>
              <nav className={cn('space-y-2', sidebarCollapsed ? 'mt-3' : 'mt-4')}>
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center rounded-xl border transition-colors',
                        sidebarCollapsed
                          ? 'h-12 justify-center'
                          : 'items-start gap-3 px-3 py-3 text-left',
                        isActive
                          ? 'border-primary/30 bg-primary/10 text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/45 hover:text-accent-foreground',
                      )}
                      aria-label={section.label}
                      onClick={() => {
                        startTransition(() => {
                          dispatch(setActiveSection(section.id));
                        });
                      }}
                    >
                      {sidebarCollapsed ? (
                        <Icon className="size-4" />
                      ) : (
                        <>
                          <span className={cn('rounded-lg border p-2', isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background/45')}>
                            <Icon className="size-4" />
                          </span>
                          <span className="space-y-1">
                            <span className="block text-sm font-medium">{section.label}</span>
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </nav>
            </section>

            <div className={cn(
              'rounded-xl border border-border/70 bg-background/45 text-center',
              sidebarCollapsed ? 'mx-1 px-2 py-3' : 'px-2 py-3',
            )}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{loadStatus === 'failed' ? 'OFF' : 'ON'}</p>
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border/70 bg-[var(--surface-toolbar)]/88 px-3 py-2 md:hidden">
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

            <div className={cn(
              'min-h-0 flex-1 px-4 py-4 lg:px-5 lg:py-5',
              isReposSection || isActionsSection ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
            )}>
              {activeSection === 'overview' ? renderOverviewContent() : null}
              {isReposSection ? renderReposContent() : null}
              {isActionsSection ? renderActionsContent() : null}
              {isAccountsSection ? renderAccountsContent() : null}
              {activeSection === 'settings' ? renderSettingsContent() : null}
            </div>
          </main>
        </div>

        <footer className="relative z-10 border-t border-border/70 bg-[var(--surface-chrome)]/92 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="font-mono">{t('shell.statusBar.section', { ns: 'common' })}: {sectionMeta.label}</span>
            <span className="font-mono">{t('shell.statusBar.account', { ns: 'common' })}: {activeAccount ? `@${activeAccount.login}` : t('shell.statusBar.none', { ns: 'common' })}</span>
            <span className="font-mono">{t('shell.statusBar.repos', { ns: 'common' })}: {repos.length}</span>
            <span className="font-mono">{t('shell.statusBar.orgs', { ns: 'common' })}: {orgs.length}</span>
            <span className="font-mono">{t('shell.statusBar.runtime', { ns: 'common' })}: {loadStatus === 'failed' ? t('shell.runtimeUnavailable', { ns: 'common' }) : t('shell.statusBar.ready', { ns: 'common' })}</span>
          </div>
        </footer>
      </div>

      <AddAccountDialog open={isAddAccountOpen} onClose={closeAddAccountDialog} />
    </div>
  );
}

export default HubShell;
