import { Building2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RepoCard from './RepoCard';
import type { GitHubOrg, GitHubRepo } from '../../../../shared/api';

interface RepoGroupProps {
  org: GitHubOrg | null;
  repos: GitHubRepo[];
}

function RepoGroup({ org, repos }: RepoGroupProps) {
  const { t } = useTranslation('github');
  const title = org ? org.login : t('repoList.personalRepos');

  return (
    <section className="editor-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {org ? (
            <img src={org.avatarUrl} alt={org.login} className="size-11 rounded-xl border border-border/70 object-cover" />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/45 text-primary">
              <UserRound className="size-4" />
            </span>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-foreground">{title}</h4>
              <span className="status-chip">{t('repoList.repoCountLabel', { count: repos.length })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          {org ? <Building2 className="size-4 text-primary" /> : <UserRound className="size-4 text-primary" />}
          {org ? '@org' : '@personal'}
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {repos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>
    </section>
  );
}

export default RepoGroup;
