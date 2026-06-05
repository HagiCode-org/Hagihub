import { useEffect, useEffectEvent, useState } from 'react';
import { CheckCircle2, ExternalLink, Github, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  applyDeviceFlowUpdate,
  cancelDeviceFlow,
  resetDeviceFlowState,
  startDeviceFlow,
} from '@/store/slices/githubAccountsSlice';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

function AddAccountDialog({ open, onClose }: AddAccountDialogProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const [browserError, setBrowserError] = useState<string | null>(null);
  const {
    deviceFlowStatus,
    latestAccount,
    error,
    userCode,
    verificationUri,
  } = useAppSelector((state) => state.githubAccounts);

  const handleDeviceFlowEvent = useEffectEvent((event: WindowEventMap['hagihub:device-flow-update']) => {
    dispatch(applyDeviceFlowUpdate(event.detail));
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const listener = (event: WindowEventMap['hagihub:device-flow-update']) => {
      handleDeviceFlowEvent(event);
    };

    window.addEventListener('hagihub:device-flow-update', listener);
    return () => {
      window.removeEventListener('hagihub:device-flow-update', listener);
    };
  }, [handleDeviceFlowEvent, open]);

  useEffect(() => {
    if (!open || deviceFlowStatus !== 'idle') {
      return;
    }

    setBrowserError(null);
    void dispatch(startDeviceFlow());
  }, [deviceFlowStatus, dispatch, open]);

  if (!open) {
    return null;
  }

  const openBrowser = async () => {
    if (!verificationUri) {
      return;
    }

    setBrowserError(null);
    const result = await window.hagihub.openExternal(verificationUri);
    if (!result.success) {
      setBrowserError(result.error ?? t('errors.openBrowserFailed'));
    }
  };

  const closeDialog = async () => {
    if (deviceFlowStatus === 'requesting' || deviceFlowStatus === 'polling') {
      await dispatch(cancelDeviceFlow());
    }

    dispatch(resetDeviceFlowState());
    setBrowserError(null);
    onClose();
  };

  const restartFlow = async () => {
    dispatch(resetDeviceFlowState());
    setBrowserError(null);
    await dispatch(startDeviceFlow());
  };

  const statusMessage = deviceFlowStatus === 'requesting'
    ? t('deviceFlow.requesting')
    : deviceFlowStatus === 'polling'
      ? t('deviceFlow.waiting')
      : deviceFlowStatus === 'success'
        ? t('deviceFlow.success')
        : error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,18,0.78)] px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <h2 className="text-2xl font-semibold text-foreground">{t('deviceFlow.title')}</h2>
          <Button variant="ghost" size="icon" onClick={() => void closeDialog()} aria-label={t('deviceFlow.close')}>
            <X />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {deviceFlowStatus === 'success' && latestAccount ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-[1.5rem] border border-primary/25 bg-primary/10 px-4 py-3 text-primary">
                <CheckCircle2 className="size-5" />
                <span className="text-sm font-medium">{t('deviceFlow.success')}</span>
              </div>

              <div className="rounded-[1.5rem] border border-border/70 bg-background/45 p-5">
                <div className="flex items-center gap-4">
                  <img
                    src={latestAccount.avatarUrl}
                    alt={latestAccount.login}
                    className="size-14 rounded-2xl border border-border/70 object-cover"
                  />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">@{latestAccount.login}</p>
                    <p className="text-sm text-muted-foreground">{latestAccount.name ?? t('deviceFlow.githubUser')}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => void closeDialog()}>{t('deviceFlow.close')}</Button>
                <Button onClick={() => void closeDialog()}>{t('deviceFlow.done')}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-[1.75rem] border border-border/70 bg-background/45 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('deviceFlow.codeLabel')}</p>
                  <div className="mt-3 rounded-[1.25rem] border border-primary/20 bg-primary/10 px-4 py-5 font-mono text-3xl font-semibold tracking-[0.24em] text-primary">
                    {userCode ?? '......'}
                  </div>
                  <div className="mt-5 space-y-2 text-sm leading-7 text-muted-foreground">
                    <p>{t('deviceFlow.steps.open')}</p>
                    <p>{t('deviceFlow.steps.enter')}</p>
                    <p>{t('deviceFlow.steps.finish')}</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-border/70 bg-background/45 p-5">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    {deviceFlowStatus === 'requesting' || deviceFlowStatus === 'polling' ? (
                      <LoaderCircle className="size-4 animate-spin text-primary" />
                    ) : (
                      <Github className="size-4 text-primary" />
                    )}
                    <span className="font-medium">{statusMessage}</span>
                  </div>

                  <Button className="w-full" size="lg" onClick={() => void openBrowser()} disabled={!verificationUri}>
                    <ExternalLink /> {t('deviceFlow.openBrowser')}
                  </Button>

                  {browserError ? (
                    <p className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                      {browserError}
                    </p>
                  ) : null}

                  {deviceFlowStatus === 'error' && error ? (
                    <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-4">
                      <p className="text-sm text-destructive">{error}</p>
                      <Button variant="outline" onClick={() => void restartFlow()}>
                        <RefreshCw /> {t('deviceFlow.retry')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => void closeDialog()}>{t('deviceFlow.cancel')}</Button>
                {deviceFlowStatus === 'error' ? (
                  <Button onClick={() => void restartFlow()}>
                    <RefreshCw /> {t('deviceFlow.retry')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddAccountDialog;
