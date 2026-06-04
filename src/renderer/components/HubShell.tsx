import { startTransition, useEffect } from 'react';
import { Bolt, Cpu, ExternalLink, Layers3, RefreshCw, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAppInfo } from '@/store/slices/hubSlice';
import { setActiveSection, type NavigationSection } from '@/store/slices/navigationSlice';

const repoUrl = 'https://github.com/HagiCode-org/Hagihub';

const sectionDefinitions: Array<{
  id: NavigationSection;
  icon: typeof Layers3;
}> = [
  { id: 'overview', icon: Layers3 },
  { id: 'workspace', icon: Bolt },
  { id: 'settings', icon: Settings2 },
];

type RoadmapItem = {
  title: string;
  detail: string;
};

function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ensureRoadmapItems(value: unknown): RoadmapItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is RoadmapItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.title === 'string' &&
          typeof item.detail === 'string',
      )
    : [];
}

function HubShell() {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const { appInfo, loadError, loadStatus } = useAppSelector((state) => state.hub);
  const activeSection = useAppSelector((state) => state.navigation.activeSection);

  useEffect(() => {
    document.getElementById('loading-container')?.remove();

    if (loadStatus === 'idle') {
      void dispatch(fetchAppInfo());
    }
  }, [dispatch, loadStatus]);

  const sections = sectionDefinitions.map((section) => ({
    ...section,
    label: t(`navigation.sections.${section.id}.label`),
    description: t(`navigation.sections.${section.id}.description`),
  }));

  const sectionMeta = sections.find((section) => section.id === activeSection) ?? sections[0];
  const foundationModules = ensureStringArray(t('shell.foundationModules', { returnObjects: true }));
  const roadmapItems = ensureRoadmapItems(t(`shell.roadmap.${activeSection}`, { returnObjects: true }));
  const nextSteps = ensureStringArray(t('shell.nextSteps', { returnObjects: true }));
  const loadingLabel = t('shell.loading');

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-5 flex h-[calc(100vh-2.5rem)] flex-col rounded-[2rem] border border-border/70 bg-card/78 p-4 shadow-[0_24px_80px_rgba(3,6,18,0.28)] backdrop-blur-xl">
            <div className="space-y-4 px-2 pb-5 pt-3">
              <Badge className="w-fit">{t('shell.foundationBadge')}</Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('shell.title')}</h1>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">{t('shell.description')}</p>
              </div>
              <LanguageSwitcher />
            </div>

            <nav className="space-y-2 px-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;

                return (
                  <button
                    key={section.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-secondary text-secondary-foreground shadow-lg shadow-black/10'
                        : 'text-muted-foreground hover:bg-accent/55 hover:text-accent-foreground',
                    )}
                    onClick={() => {
                      startTransition(() => {
                        dispatch(setActiveSection(section.id));
                      });
                    }}
                  >
                    <span
                      className={cn(
                        'mt-0.5 rounded-xl border p-2',
                        isActive ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border/70 bg-background/35',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">{section.label}</span>
                      <span className="block text-xs leading-5 text-muted-foreground">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-border/60 bg-background/45 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Cpu className="size-4 text-primary" /> {t('shell.runtimeSnapshot')}
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{t('shell.info.channel')}</dt>
                  <dd>{appInfo ? t(`shell.buildChannel.${appInfo.buildChannel}`) : loadingLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{t('shell.info.platform')}</dt>
                  <dd>{appInfo?.platform ?? loadingLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{t('shell.info.version')}</dt>
                  <dd>{appInfo ? `v${appInfo.appVersion}` : loadingLabel}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen min-w-0 flex-1 flex-col gap-6 py-1">
          <Card className="overflow-hidden bg-card/82">
            <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)] md:px-8 md:py-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{sectionMeta.label}</Badge>
                  <Badge variant={loadStatus === 'failed' ? 'outline' : 'default'}>
                    {loadStatus === 'loading'
                      ? t('shell.loadingRuntime')
                      : loadStatus === 'failed'
                        ? t('shell.runtimeUnavailable')
                        : t('shell.runtimeConnected')}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {t('shell.prepareTitle')}
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {t('shell.prepareDescription')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => void window.hagihub.openExternal(repoUrl)}>
                    <ExternalLink /> {t('shell.openRepository')}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => void dispatch(fetchAppInfo())}>
                    <RefreshCw /> {t('shell.refreshRuntime')}
                  </Button>
                </div>
                {loadError ? (
                  <p className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {loadError}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3">
                <div className="rounded-[1.75rem] border border-border/70 bg-background/55 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('shell.rendererStackLabel')}</p>
                  <p className="mt-3 text-lg font-medium text-foreground">{t('shell.rendererStackValue')}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('shell.rendererStackDescription')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-border/70 bg-background/55 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('shell.appModeLabel')}</p>
                    <p className="mt-2 text-lg font-medium">
                      {appInfo?.isPackaged ? t('shell.appModePackaged') : t('shell.appModeDevelopment')}
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-border/70 bg-background/55 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('shell.electronLabel')}</p>
                    <p className="mt-2 text-lg font-medium">{appInfo?.electronVersion ?? loadingLabel}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>{sectionMeta.label}</CardTitle>
                <CardDescription>{sectionMeta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {roadmapItems.map((item) => (
                    <div key={item.title} className="rounded-[1.5rem] border border-border/70 bg-background/45 p-4">
                      <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.foundationModulesLabel')}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {foundationModules.map((moduleName) => (
                      <div key={moduleName} className="rounded-[1.35rem] border border-border/65 bg-background/40 px-4 py-3 text-sm text-foreground">
                        {moduleName}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('shell.environmentSnapshotTitle')}</CardTitle>
                <CardDescription>{t('shell.environmentSnapshotDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background/50 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{t('shell.info.app')}</span>
                    <span>{appInfo?.appName ?? loadingLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{t('shell.info.version')}</span>
                    <span>{appInfo ? `v${appInfo.appVersion}` : loadingLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{t('shell.info.chrome')}</span>
                    <span>{appInfo?.chromeVersion ?? loadingLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{t('shell.info.node')}</span>
                    <span>{appInfo?.nodeVersion ?? loadingLabel}</span>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('shell.suggestedNextSteps')}</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                    {nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default HubShell;
