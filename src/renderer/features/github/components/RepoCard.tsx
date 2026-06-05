import { useState } from 'react';
import { ArrowUpRight, GitFork, Info, LockKeyhole, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitHubRepo } from '../../../../shared/api';
import RepoInfoSheet from './RepoInfoSheet';

interface RepoCardProps {
  repo: GitHubRepo;
}

function RepoCard({ repo }: RepoCardProps) {
  const { t, i18n } = useTranslation('github');
  const [showInfo, setShowInfo] = useState(false);

  const updatedAt = new Date(repo.updatedAt).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="grid gap-4 px-5 py-4 transition-colors hover:bg-accent/18 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.95fr)_auto] lg:items-center">
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={repo.owner.avatarUrl} alt={repo.owner.login} className="size-10 rounded-xl border border-border/70 object-cover" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-semibold text-foreground">{repo.fullName}</h4>
              <Badge variant={repo.isPrivate ? 'default' : 'outline'}>
                {repo.isPrivate ? <LockKeyhole className="size-3.5" /> : <Radio className="size-3.5" />}
                {repo.isPrivate ? t('repoCard.private') : t('repoCard.public')}
              </Badge>
              {repo.isFork ? (
                <Badge variant="secondary">
                  <GitFork className="size-3.5" /> {t('repoCard.fork')}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{repo.name}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {repo.description?.trim().length ? repo.description : t('repoCard.noDescription')}
        </p>
      </div>

      <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.owner')}</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">@{repo.owner.login}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('repoCard.updated')}</dt>
          <dd className="mt-1 font-mono text-xs text-foreground">{updatedAt}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
        <Button variant="outline" size="sm" onClick={() => setShowInfo(true)}>
          <Info /> {t('repoCard.info.title')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void window.hagihub.openExternal(repo.htmlUrl)}>
          <ArrowUpRight /> {t('repoCard.openRepo')}
        </Button>
      </div>

      {showInfo ? (
        <RepoInfoSheet
          owner={repo.owner.login}
          repo={repo.name}
          onClose={() => setShowInfo(false)}
        />
      ) : null}
    </div>
  );
}

export default RepoCard;
