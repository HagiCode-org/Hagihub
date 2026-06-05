import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Code2,
  Eye,
  GitFork,
  Globe,
  Info,
  Languages,
  LoaderCircle,
  Scale,
  Star,
  Tag,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store';
import type { GitHubRepoDetails, UpdateRepoPayload } from '../../../../shared/api';

interface RepoInfoSheetProps {
  owner: string;
  repo: string;
  onClose: () => void;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

function formatDate(isoString: string | null, locale: string): string {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function RepoInfoSheet({ owner, repo, onClose }: RepoInfoSheetProps) {
  const { t, i18n } = useTranslation('github');
  const activeAccountId = useAppSelector((state) => state.githubAccounts.activeAccountId);
  const [details, setDetails] = useState<GitHubRepoDetails | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editHomepage, setEditHomepage] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const loadDetails = useCallback(async () => {
    if (!activeAccountId) return;
    setLoadState('loading');
    setError(null);
    try {
      const result = await window.hagihub.fetchRepoDetails(activeAccountId, owner, repo);
      setDetails(result.details);
      setLoadState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadState('error');
    }
  }, [activeAccountId, owner, repo]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const startEditing = () => {
    if (!details) return;
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
    if (!activeAccountId || !details) return;
    setSaving(true);
    setSaveMessage(null);
    const updates: UpdateRepoPayload = {};
    const trimmedDesc = editDescription.trim();
    const trimmedHomepage = editHomepage.trim();
    const parsedTopics = editTopics.split(',').map((t) => t.trim()).filter(Boolean);
    const topicsChanged = JSON.stringify(parsedTopics) !== JSON.stringify(details.topics);

    if (trimmedDesc !== (details.description ?? '')) {
      updates.description = trimmedDesc;
    }
    if (trimmedHomepage !== (details.homepage ?? '')) {
      updates.homepage = trimmedHomepage;
    }

    try {
      if (Object.keys(updates).length > 0) {
        const result = await window.hagihub.updateRepo(activeAccountId, owner, repo, updates);
        setDetails(result.details);
      }

      if (topicsChanged) {
        const topicsResult = await window.hagihub.updateRepoTopics(activeAccountId, owner, repo, parsedTopics);
        setDetails((prev) => prev ? { ...prev, topics: topicsResult.names } : prev);
      }

      setIsEditing(false);
      setSaveMessage(t('repoCard.info.saveSuccess'));
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : t('repoCard.info.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('repoCard.info.title')}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-lg flex-col border-l border-border/70 bg-[var(--surface-panel)]/98 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <Info className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('repoCard.info.title')}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadState === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LoaderCircle className="size-6 animate-spin text-primary" />
              <p className="mt-3 text-sm">{t('repoList.loading')}</p>
            </div>
          ) : loadState === 'error' ? (
            <div className="py-16 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadDetails()}>
                {t('repoList.retry')}
              </Button>
            </div>
          ) : details ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
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
                    <span className="font-mono text-xs text-foreground break-all">{details.htmlUrl}</span>
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
                        onChange={(e) => setEditDescription(e.target.value)}
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
                        onChange={(e) => setEditHomepage(e.target.value)}
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
                        onChange={(e) => setEditTopics(e.target.value)}
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
                          <span className="font-mono text-xs text-foreground break-all">{details.homepage}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            onClick={() => void window.hagihub.openExternal(details.homepage!)}
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

              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={<Code2 />} label={t('repoCard.info.language')} value={details.language ?? '-'} />
                <InfoRow icon={<Scale />} label={t('repoCard.info.license')} value={details.license?.name ?? '-'} />
                <InfoRow icon={<GitFork />} label={t('repoCard.info.defaultBranch')} value={details.defaultBranch} />
                <InfoRow icon={<Eye />} label={t('repoCard.info.visibility')} value={details.visibility} />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <StatBox label={t('repoCard.info.stars')} value={formatNumber(details.stargazersCount)} icon={<Star className="size-3.5" />} />
                <StatBox label={t('repoCard.info.forks')} value={formatNumber(details.forksCount)} icon={<GitFork className="size-3.5" />} />
                <StatBox label={t('repoCard.info.openIssues')} value={formatNumber(details.openIssuesCount)} icon={<Info className="size-3.5" />} />
                <StatBox label={t('repoCard.info.watchers')} value={formatNumber(details.watchersCount)} icon={<Eye className="size-3.5" />} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <DateRow icon={<Calendar />} label={t('repoCard.info.createdAt')} value={formatDate(details.createdAt, locale)} />
                <DateRow icon={<Calendar />} label={t('repoCard.info.updatedAt')} value={formatDate(details.updatedAt, locale)} />
                <DateRow icon={<Calendar />} label={t('repoCard.info.pushedAt')} value={formatDate(details.pushedAt, locale)} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 px-5 py-3">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                {t('repoCard.info.cancel')}
              </Button>
              <Button size="sm" onClick={() => void saveChanges()} disabled={saving}>
                {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {saving ? t('repoCard.info.saving') : t('repoCard.info.save')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing} disabled={loadState !== 'loaded'}>
              <Tag className="size-3.5" />
              {t('repoCard.info.edit')}
            </Button>
          )}
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

export default RepoInfoSheet;
