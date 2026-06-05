import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearMigrationNotice, removeAccount } from '@/store/slices/githubAccountsSlice';

interface AccountManagementPageProps {
  onAddAccount: () => void;
}

function AccountManagementPage({ onAddAccount }: AccountManagementPageProps) {
  const { t, i18n } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { accounts, migrationNoticeDismissed } = useAppSelector((state) => state.githubAccounts);

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleRemove = async (accountId: string, login: string) => {
    const confirmed = window.confirm(t('accountSelector.removeConfirm', { login }));
    if (!confirmed) {
      return;
    }

    await dispatch(removeAccount(accountId));
  };

  return (
    <div className="space-y-4">
      <section className="editor-panel p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t('accountManagement.badge')}</Badge>
              <Badge variant="outline">{t('accountSelector.connectedCount', { count: accounts.length })}</Badge>
            </div>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {t('accountManagement.title')}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('accountManagement.description')}
            </p>
          </div>

          <Button onClick={onAddAccount}>
            <Plus /> {t('workspace.addAccount')}
          </Button>
        </div>

        {!migrationNoticeDismissed ? (
          <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-300/8 px-4 py-3 text-sm leading-6 text-sky-100/88">
            <div className="flex items-start justify-between gap-4">
              <span>{t('accountManagement.migrationHint')}</span>
              <button
                type="button"
                className="shrink-0 text-sky-50/85 transition hover:text-sky-50"
                onClick={() => dispatch(clearMigrationNotice())}
              >
                x
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {accounts.length === 0 ? (
        <section className="editor-panel px-6 py-12 text-center">
          <p className="text-base font-medium text-foreground">{t('accountManagement.emptyTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('accountManagement.emptyDescription')}</p>
          <Button className="mt-5" onClick={onAddAccount}>
            <Plus /> {t('workspace.addAccount')}
          </Button>
        </section>
      ) : (
        <section className="editor-panel p-5 lg:p-6">
          <div className="space-y-3">
            {accounts.map((account) => {
              const storageKey = account.storageMode === 'plaintext' ? 'plaintextStorageShort' : 'encryptedStorage';

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/35 px-4 py-4 transition-colors hover:bg-accent/18 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <img src={account.avatarUrl} alt={account.login} className="size-12 rounded-xl border border-border/70 object-cover" />
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-foreground">@{account.login}</span>
                        <span className="status-chip">{t(`accountSelector.${storageKey}`)}</span>
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">{account.name ?? t('deviceFlow.githubUser')}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{t('accountSelector.addedAt', { date: formatDate(account.addedAt) })}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {account.storageMode !== 'plaintext' ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-300/8 px-3 py-2 text-xs text-emerald-100">
                        <ShieldCheck className="size-3.5" />
                        {t('accountSelector.encryptedStorage')}
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemove(account.id, account.login)}
                      aria-label={t('accountSelector.remove')}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  {account.storageMode === 'plaintext' ? (
                    <p className="rounded-xl border border-amber-400/20 bg-amber-300/8 px-3 py-2 text-xs leading-6 text-amber-100/85 lg:basis-full">
                      {t('accountSelector.plaintextStorage')}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="editor-panel p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {t('accountManagement.hint')}
        </p>
      </section>
    </div>
  );
}

export default AccountManagementPage;
