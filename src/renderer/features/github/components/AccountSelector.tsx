import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { removeAccount, switchAccount } from '@/store/slices/githubAccountsSlice';

interface AccountSelectorProps {
  onAddAccount: () => void;
}

function AccountSelector({ onAddAccount }: AccountSelectorProps) {
  const { t, i18n } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { accounts, activeAccountId } = useAppSelector((state) => state.githubAccounts);

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
    <section className="editor-panel p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('accountSelector.eyebrow')}</Badge>
            <Badge variant="outline">{t('accountSelector.connectedCount', { count: accounts.length })}</Badge>
          </div>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('accountSelector.title')}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{t('accountSelector.description')}</p>
          </div>
        </div>

        <Button variant="outline" onClick={onAddAccount}>
          <Plus /> {t('workspace.addAccount')}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {accounts.map((account) => {
          const isActive = account.id === activeAccountId;
          const storageKey = account.storageMode === 'plaintext' ? 'plaintextStorageShort' : 'encryptedStorage';

          return (
            <div
              key={account.id}
              className={cn(
                'flex flex-col gap-4 rounded-xl border px-4 py-4 transition-colors lg:flex-row lg:items-center lg:justify-between',
                isActive ? 'border-primary/30 bg-primary/10' : 'border-border/70 bg-background/35 hover:bg-accent/18',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                onClick={() => void dispatch(switchAccount(account.id))}
                disabled={isActive}
              >
                <img src={account.avatarUrl} alt={account.login} className="size-12 rounded-xl border border-border/70 object-cover" />
                <span className="min-w-0 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-foreground">@{account.login}</span>
                    {isActive ? <Badge>{t('accountSelector.active')}</Badge> : null}
                    <span className="status-chip">{t(`accountSelector.${storageKey}`)}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{account.name ?? t('deviceFlow.githubUser')}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{t('accountSelector.addedAt', { date: formatDate(account.addedAt) })}</span>
                </span>
              </button>

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
  );
}

export default AccountSelector;
