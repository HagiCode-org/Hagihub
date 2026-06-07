import { FileText, Globe, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CreateGitHubRepoPayload } from '../../../../shared/api';
import {
  SPECIAL_REPO_PATTERNS,
  canUseSpecialRepoPattern,
  type SpecialRepoPatternId,
} from '../../../../shared/github-special-repos';

interface SpecialRepoChipsProps {
  owner: CreateGitHubRepoPayload['owner'];
  selectedPatternId: SpecialRepoPatternId | null;
  disabled?: boolean;
  onSelect: (patternId: SpecialRepoPatternId, resolvedName: string) => void;
}

function SpecialRepoChips({ owner, selectedPatternId, disabled = false, onSelect }: SpecialRepoChipsProps) {
  const { t } = useTranslation('github');
  const visiblePatterns = SPECIAL_REPO_PATTERNS.filter((pattern) => canUseSpecialRepoPattern(pattern, owner.type));

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {visiblePatterns.map((pattern) => {
        const isActive = pattern.id === selectedPatternId;
        const resolvedName = pattern.resolveName(owner.login);
        const Icon = pattern.id === 'github'
          ? FileText
          : pattern.id === 'github-pages'
            ? Globe
            : User;
        const copy = pattern.id === 'github'
          ? {
              label: t('createDialog.specialRepos.github.label'),
              description: t('createDialog.specialRepos.github.description'),
              tooltip: t('createDialog.specialRepos.github.description'),
            }
          : pattern.id === 'github-pages'
            ? {
                label: t('createDialog.specialRepos.githubPages.label'),
                description: t('createDialog.specialRepos.githubPages.description'),
                tooltip: t('createDialog.specialRepos.githubPages.tooltip', { owner: owner.login }),
              }
            : {
                label: t('createDialog.specialRepos.username.label', { owner: owner.login }),
                description: t('createDialog.specialRepos.username.description'),
                tooltip: t('createDialog.specialRepos.username.tooltip'),
              };

        return (
          <button
            key={pattern.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            title={copy.tooltip}
            className={cn(
              badgeVariants({ variant: isActive ? 'default' : 'outline' }),
              'h-auto w-full items-start justify-start gap-3 rounded-2xl px-4 py-3 text-left whitespace-normal normal-case tracking-normal focus-visible:ring-primary/30',
              isActive
                ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                : 'bg-background/35 text-foreground hover:border-primary/30 hover:bg-accent/22',
            )}
            onClick={() => onSelect(pattern.id, resolvedName)}
          >
            <span className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border',
              isActive
                ? 'border-primary/25 bg-primary/15 text-primary'
                : 'border-border/70 bg-background/55 text-muted-foreground',
            )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{copy.label}</span>
                {isActive ? <span className="status-chip">{t('createDialog.selected')}</span> : null}
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">{copy.description}</span>
              <span className="mt-2 block font-mono text-[11px] text-muted-foreground">{resolvedName}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SpecialRepoChips;
