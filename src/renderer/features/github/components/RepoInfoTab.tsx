import { useState } from 'react';
import { ArrowUpRight, Calendar, Code2, Eye, GitFork, Globe, Info, LoaderCircle, Scale, Star, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GitHubRepoDetails, UpdateRepoPayload } from '../../../../shared/api';

interface RepoInfoTabProps {
  accountId: string | null;
  owner: string;
  repo: string;
  locale: string;
  details: GitHubRepoDetails;
  onDetailsChange: (details: GitHubRepoDetails) => void;
}

function formatDate(isoString: string | null, locale: string): string {
  if (!isoString) {
    return '-';
  }

  return new Date(isoString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(value);
}

function RepoInfoTab({ accountId, owner, repo, locale, details, onDetailsChange }: RepoInfoTabProps) {
  const { t } = useTranslation('github');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editHomepage, setEditHomepage] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const startEditing = () => {
    setEditDescription(details.description ?? '');
    setEditHomepage(details.homepage ?? '');
    setEditTopics(details.topics.join(', '));
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveMessage(null);
  };

  const saveChanges = async () => {
    if (!accountId) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    const updates: UpdateRepoPayload = {};
    const trimmedDesc = editDescription.trim();
    const trimmedHomepage = editHomepage.trim();
    const parsedTopics = editTopics.split(',').map((topic) => topic.trim()).filter(Boolean);
    const topicsChanged = JSON.stringify(parsedTopics) !== JSON.stringify(details.topics);

    if (trimmedDesc !== (details.description ?? '')) {
      updates.description = trimmedDesc;
    }

    if (trimmedHomepage !== (details.homepage ?? '')) {
      updates.homepage = trimmedHomepage;
    }

    try {
      let nextDetails = details;

      if (Object.keys(updates).length > 0) {
        const result = await window.hagihub.updateRepo(accountId, owner, repo, updates);
        nextDetails = result.details;
      }

      if (topicsChanged) {
        const topicsResult = await window.hagihub.updateRepoTopics(accountId, owner, repo, parsedTopics);
        nextDetails = { ...nextDetails, topics: topicsResult.names };
      }

      onDetailsChange(nextDetails);
      setIsEditing(false);
      setSaveMessage(t('repoCard.info.saveSuccess'));
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : t('repoCard.info.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                  {t('repoCard.info.cancel')}
                </Button>
                <Button size="sm" onClick={() => void saveChanges()} disabled={saving || !accountId}>
                  {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                  {saving ? t('repoCard.info.saving') : t('repoCard.info.save')}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEditing} disabled={!accountId}>
                <Tag className="size-3.5" />
                {t('repoCard.info.edit')}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">{details.fullName}</h3>
            <Badge variant={details.visibility === 'private' ? 'default' : 'outline'}>
              {details.visibility}
            </Badge>
          </div>

          <div className="panel-muted space-y-4 p-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t('repoCard.info.url')}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="break-all font-mono text-xs text-foreground">{details.htmlUrl}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => void window.hagihub.openExternal(details.htmlUrl)}
                >
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </div>
            </div>

            {isEditing ? (
              <>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t('repoCard.info.description')}
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    rows={3}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    placeholder={t('repoCard.info.descriptionPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t('repoCard.info.homepage')}
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    value={editHomepage}
                    onChange={(event) => setEditHomepage(event.target.value)}
                    placeholder={t('repoCard.info.homepagePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t('repoCard.info.topics')}
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    value={editTopics}
                    onChange={(event) => setEditTopics(event.target.value)}
                    placeholder={t('repoCard.info.topicsPlaceholder')}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t('repoCard.info.description')}
                  </label>
                  <p className="mt-1 text-sm leading-6 text-foreground">
                    {details.description?.trim() || t('repoCard.info.descriptionPlaceholder')}
                  </p>
                </div>
                {details.homepage ? (
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {t('repoCard.info.homepage')}
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <Globe className="size-3.5 text-muted-foreground" />
                      <span className="break-all font-mono text-xs text-foreground">{details.homepage}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0"
                        onClick={() => {
                          void window.hagihub.openExternal(details.homepage!);
                        }}
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {t('repoCard.info.topics')}
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {details.topics.length > 0 ? (
                      details.topics.map((topic) => (
                        <span key={topic} className="status-chip">
                          {topic}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('repoCard.info.noTopics')}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {saveMessage ? (
            <p className={cn('text-xs', saveMessage === t('repoCard.info.saveSuccess') ? 'text-emerald-400' : 'text-destructive')}>
              {saveMessage}
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoRow icon={<Code2 />} label={t('repoCard.info.language')} value={details.language ?? '-'} />
            <InfoRow icon={<Scale />} label={t('repoCard.info.license')} value={details.license?.name ?? '-'} />
            <InfoRow icon={<GitFork />} label={t('repoCard.info.defaultBranch')} value={details.defaultBranch} />
            <InfoRow icon={<Eye />} label={t('repoCard.info.visibility')} value={details.visibility} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatBox label={t('repoCard.info.stars')} value={formatNumber(details.stargazersCount)} icon={<Star className="size-3.5" />} />
            <StatBox label={t('repoCard.info.forks')} value={formatNumber(details.forksCount)} icon={<GitFork className="size-3.5" />} />
            <StatBox label={t('repoCard.info.openIssues')} value={formatNumber(details.openIssuesCount)} icon={<Info className="size-3.5" />} />
            <StatBox label={t('repoCard.info.watchers')} value={formatNumber(details.watchersCount)} icon={<Eye className="size-3.5" />} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <DateRow icon={<Calendar />} label={t('repoCard.info.createdAt')} value={formatDate(details.createdAt, locale)} />
            <DateRow icon={<Calendar />} label={t('repoCard.info.updatedAt')} value={formatDate(details.updatedAt, locale)} />
            <DateRow icon={<Calendar />} label={t('repoCard.info.pushedAt')} value={formatDate(details.pushedAt, locale)} />
          </div>
        </div>
      </div>

    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel-muted flex items-center gap-3 px-3 py-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="panel-muted p-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <p className="mt-1 font-mono text-sm text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );
}

function DateRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel-muted px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

export default RepoInfoTab;
