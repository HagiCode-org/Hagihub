import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    <div className="rounded-[1.75rem] border border-border/70 bg-background/45 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('accountSelector.eyebrow')}</p>
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('accountSelector.title')}</h3>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{t('accountSelector.description')}</p>
          </div>
        </div>

        <Button variant="outline" onClick={onAddAccount}>
          <Plus /> {t('workspace.addAccount')}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {accounts.map((account) => {
          const isActive = account.id === activeAccountId;

          return (
            <div
              key={account.id}
              className={isActive
                ? 'rounded-[1.5rem] border border-primary/30 bg-primary/10 p-4'
                : 'rounded-[1.5rem] border border-border/70 bg-card/50 p-4'}
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-4 text-left"
                  onClick={() => void dispatch(switchAccount(account.id))}
                  disabled={isActive}
                >
                  <img
                    src={account.avatarUrl}
                    alt={account.login}
                    className="size-12 rounded-2xl border border-border/70 object-cover"
                  />
                  <span className="space-y-1">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold text-foreground">@{account.login}</span>
                      {isActive ? <Badge>{t('accountSelector.active')}</Badge> : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">{account.name ?? t('deviceFlow.githubUser')}</span>
                    <span className="block text-xs text-muted-foreground">{t('accountSelector.addedAt', { date: formatDate(account.addedAt) })}</span>
                  </span>
                </button>

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
                <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-300/10 px-3 py-2 text-xs leading-6 text-amber-100/85">
                  {t('accountSelector.plaintextStorage')}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccountSelector;
