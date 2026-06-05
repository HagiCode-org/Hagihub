import { Settings2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveSection } from '@/store/slices/navigationSlice';

interface WorkspaceAccountEntryProps {
  onAddAccount: () => void;
}

function WorkspaceAccountEntry({ onAddAccount }: WorkspaceAccountEntryProps) {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { accounts, activeAccountId } = useAppSelector((state) => state.githubAccounts);
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;

  const navigateToAccounts = () => {
    dispatch(setActiveSection('accounts'));
  };

  if (accounts.length === 0) {
    return (
      <section className="editor-panel p-5 lg:p-6">
        <div className="space-y-3">
          <Badge variant="secondary">{t('accountSelector.eyebrow')}</Badge>
          <p className="text-sm text-muted-foreground">{t('workspaceAccountEntry.noAccounts')}</p>
          <Button variant="outline" onClick={onAddAccount}>
            {t('workspace.addAccount')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-panel p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {activeAccount ? (
            <>
              <img src={activeAccount.avatarUrl} alt={activeAccount.login} className="size-12 rounded-xl border border-border/70 object-cover" />
              <div className="min-w-0 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold text-foreground">@{activeAccount.login}</span>
                  <Badge variant="secondary">{t('accountSelector.active')}</Badge>
                </span>
                <span className="block truncate text-sm text-muted-foreground">{activeAccount.name ?? t('deviceFlow.githubUser')}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('workspaceAccountEntry.selectAccount')}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigateToAccounts}>
            <Users /> {t('workspaceAccountEntry.manageAccounts')}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {t('workspaceAccountEntry.summary', { count: accounts.length })}
      </p>
    </section>
  );
}

export default WorkspaceAccountEntry;
