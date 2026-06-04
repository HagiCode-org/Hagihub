import { ArrowUpRight, GitFork, LockKeyhole, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitHubRepo } from '../../../../shared/api';

interface RepoCardProps {
  repo: GitHubRepo;
}

function RepoCard({ repo }: RepoCardProps) {
  const { t, i18n } = useTranslation('github');

  const updatedAt = new Date(repo.updatedAt).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex h-full flex-col justify-between rounded-[1.5rem] border border-border/70 bg-card/55 p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold text-foreground">{repo.name}</h4>
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

        <p className="text-sm leading-7 text-muted-foreground">
          {repo.description?.trim().length ? repo.description : t('repoCard.noDescription')}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t('repoCard.updatedAt', { date: updatedAt })}</span>
        <Button variant="ghost" size="sm" onClick={() => void window.hagihub.openExternal(repo.htmlUrl)}>
          <ArrowUpRight /> {t('repoCard.open')}
        </Button>
      </div>
    </div>
  );
}

export default RepoCard;
