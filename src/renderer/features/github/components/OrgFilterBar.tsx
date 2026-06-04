import { Layers3, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setActiveOrgFilter, type OrgFilterValue } from '@/store/slices/githubReposSlice';

function OrgFilterBar() {
  const { t } = useTranslation('github');
  const dispatch = useAppDispatch();
  const { orgs, activeOrgFilter, personalRepos, groupedRepos, repos } = useAppSelector((state) => state.githubRepos);
  const activeAccount = useAppSelector((state) => {
    const { accounts, activeAccountId } = state.githubAccounts;
    return accounts.find((account) => account.id === activeAccountId) ?? null;
  });

  const orgRepoCounts = new Map(groupedRepos.map((group) => [group.org.login, group.repos.length]));

  const filters: Array<{ value: OrgFilterValue; label: string; icon: React.ReactNode; count: number }> = [
    {
      value: 'all',
      label: t('orgFilter.all'),
      icon: <Layers3 className="size-3.5" />,
      count: repos.length,
    },
    {
      value: 'personal',
      label: activeAccount ? `@${activeAccount.login}` : t('orgFilter.personal'),
      icon: <UserRound className="size-3.5" />,
      count: personalRepos.length,
    },
    ...orgs.map((org) => ({
      value: org.login as OrgFilterValue,
      label: org.login,
      icon: <img src={org.avatarUrl} alt={org.login} className="size-3.5 rounded-sm object-cover" />,
      count: orgRepoCounts.get(org.login) ?? 0,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = filter.value === activeOrgFilter;

        return (
          <button
            key={filter.value}
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/70 bg-background/35 text-muted-foreground hover:border-border hover:bg-accent/18 hover:text-accent-foreground',
            )}
            onClick={() => dispatch(setActiveOrgFilter(filter.value))}
          >
            {filter.icon}
            <span>{filter.label}</span>
            <span className={cn(
              'ml-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px]',
              isActive ? 'bg-primary/15 text-primary' : 'bg-background/50 text-muted-foreground',
            )}>
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default OrgFilterBar;
