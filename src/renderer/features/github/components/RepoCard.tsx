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
    <>
      <tr className="repo-table__row">
        <td className="repo-table__repo">
          <div className="flex min-w-0 items-start gap-3">
            <img src={repo.owner.avatarUrl} alt={repo.owner.login} className="mt-0.5 size-10 rounded-xl border border-border/70 object-cover" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground md:text-base">{repo.fullName}</p>
                {repo.isFork ? (
                  <Badge variant="secondary">
                    <GitFork className="size-3.5" /> {t('repoCard.fork')}
                  </Badge>
                ) : null}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground md:text-xs">{repo.name}</p>
              <p className="max-w-[72ch] text-sm leading-6 text-muted-foreground">
                {repo.description?.trim().length ? repo.description : t('repoCard.noDescription')}
              </p>
            </div>
          </div>
        </td>

        <td className="hidden lg:table-cell">
          <div className="space-y-1">
            <p className="font-mono text-xs text-foreground">@{repo.owner.login}</p>
            <p className="text-xs text-muted-foreground">{repo.owner.type}</p>
          </div>
        </td>

        <td>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={repo.isPrivate ? 'default' : 'outline'}>
              {repo.isPrivate ? <LockKeyhole className="size-3.5" /> : <Radio className="size-3.5" />}
              {repo.isPrivate ? t('repoCard.private') : t('repoCard.public')}
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground lg:hidden">@{repo.owner.login}</span>
          </div>
        </td>

        <td className="hidden md:table-cell">
          <span className="font-mono text-xs text-foreground">{updatedAt}</span>
        </td>

        <td className="repo-table__actions">
          <div className="flex flex-wrap justify-end gap-2">
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
        </td>
      </tr>
    </>
  );
}

export default RepoCard;
