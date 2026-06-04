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
  const description = org?.description ?? (org ? t('repoList.organizationRepos') : t('repoList.personalDescription'));

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-border/70 bg-background/40 p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl border border-border/70 bg-card/70 p-2 text-primary">
          {org ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
        </span>
        <div className="space-y-1">
          <h4 className="text-lg font-semibold text-foreground">{title}</h4>
          <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {repos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>
    </section>
  );
}

export default RepoGroup;
