import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  LoaderCircle,
  MousePointerClick,
  Settings2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

function SettingsPage() {
  const { t } = useTranslation('common');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [shownNotificationId, setShownNotificationId] = useState<string | null>(null);
  const [clickedNotificationId, setClickedNotificationId] = useState<string | null>(null);

  const preview = useMemo(() => ({
    title: t('settingsPage.notification.preview.title'),
    body: t('settingsPage.notification.preview.body'),
    level: 'info',
    clickAction: t('settingsPage.notification.values.focusWindow'),
    duration: '8000',
    silent: 'false',
  }), [t]);

  const previewRows = useMemo(() => ([
    { key: 'title', value: preview.title },
    { key: 'body', value: preview.body },
    { key: 'level', value: preview.level },
    { key: 'clickAction', value: preview.clickAction },
    { key: 'duration', value: preview.duration },
    { key: 'silent', value: preview.silent },
  ]), [preview]);

  const handleNotificationShown = useEffectEvent((event: WindowEventMap['hagihub:notification-shown']) => {
    setShownNotificationId(event.detail);
  });

  const handleNotificationClicked = useEffectEvent((event: WindowEventMap['hagihub:notification-clicked']) => {
    setClickedNotificationId(event.detail);
  });

  useEffect(() => {
    window.addEventListener('hagihub:notification-shown', handleNotificationShown);
    window.addEventListener('hagihub:notification-clicked', handleNotificationClicked);

    return () => {
      window.removeEventListener('hagihub:notification-shown', handleNotificationShown);
      window.removeEventListener('hagihub:notification-clicked', handleNotificationClicked);
    };
  }, [handleNotificationClicked, handleNotificationShown]);

  const handleSendTestNotification = async () => {
    setSendStatus('sending');
    setSendError(null);

    try {
      const result = await window.hagihub.sendNotification({
        title: preview.title,
        body: preview.body,
        level: 'info',
        duration: 8000,
        silent: false,
        clickAction: {
          type: 'focus-window',
          section: 'settings',
        },
      });

      if (!result.success) {
        setSendStatus('error');
        setSendError(result.error ?? t('settingsPage.notification.sendFailedFallback'));
        return;
      }

      setSendStatus('success');
    } catch (error) {
      setSendStatus('error');
      setSendError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t('settingsPage.badge')}</Badge>
          <Badge variant="outline">{t('settingsPage.notification.badge')}</Badge>
        </div>

        <div className="mt-4 max-w-3xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            {t('settingsPage.title')}
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">{t('settingsPage.description')}</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BellRing className="size-5 text-primary" />
              <CardTitle>{t('settingsPage.notification.title')}</CardTitle>
            </div>
            <CardDescription>{t('settingsPage.notification.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{t('settingsPage.notification.testSectionTitle')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('settingsPage.notification.testSectionDescription')}</p>
                </div>
                <Button type="button" onClick={() => void handleSendTestNotification()} disabled={sendStatus === 'sending'}>
                  {sendStatus === 'sending' ? <LoaderCircle className="animate-spin" /> : null}
                  {sendStatus === 'sending'
                    ? t('settingsPage.notification.sending')
                    : t('settingsPage.notification.testButton')}
                </Button>
              </div>
            </div>

            {sendStatus === 'success' ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4" />
                  {t('settingsPage.notification.testSuccess')}
                </div>
                <p className="mt-2 text-emerald-100/85">{t('settingsPage.notification.testSuccessDescription')}</p>
              </div>
            ) : null}

            {sendStatus === 'error' ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="size-4" />
                  {t('settingsPage.notification.testError')}
                </div>
                <p className="mt-2">{t('settingsPage.notification.testErrorDescription', { error: sendError ?? '-' })}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  {t('settingsPage.notification.eventShown')}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {shownNotificationId
                    ? t('settingsPage.notification.eventShownValue', { id: shownNotificationId })
                    : t('settingsPage.notification.eventPending')}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MousePointerClick className="size-4 text-primary" />
                  {t('settingsPage.notification.eventClicked')}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {clickedNotificationId
                    ? t('settingsPage.notification.eventClickedValue', { id: clickedNotificationId })
                    : t('settingsPage.notification.eventPending')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settingsPage.notification.previewTitle')}</CardTitle>
              <CardDescription>{t('settingsPage.notification.previewDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewRows.map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t(`settingsPage.notification.fields.${row.key}`)}</span>
                  <Badge variant="outline" className="max-w-[65%] break-all text-right font-normal normal-case tracking-normal">{row.value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="size-5 text-primary" />
                <CardTitle>{t('settingsPage.workspaceTitle')}</CardTitle>
              </div>
              <CardDescription>{t('settingsPage.workspaceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div className="panel-muted px-4 py-3">{t('settingsPage.workspaceHint1')}</div>
              <div className="panel-muted px-4 py-3">{t('settingsPage.workspaceHint2')}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
