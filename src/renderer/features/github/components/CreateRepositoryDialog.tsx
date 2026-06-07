import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe2, LoaderCircle, Lock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';
import type { CreateGitHubRepoPayload, GitHubAccountSummary, GitHubOrg } from '../../../../shared/api';

interface CreateRepositoryDialogProps {
  open: boolean;
  activeAccount: GitHubAccountSummary | null;
  orgs: GitHubOrg[];
  submitStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateGitHubRepoPayload) => void;
}

const gitignoreOptions: SearchableSelectOption[] = [
  { value: 'Node', label: 'Node' },
  { value: 'VisualStudio', label: 'Visual Studio' },
  { value: 'VisualStudioCode', label: 'VS Code' },
  { value: 'JetBrains', label: 'JetBrains' },
  { value: 'Python', label: 'Python' },
  { value: 'Go', label: 'Go' },
  { value: 'Rust', label: 'Rust' },
  { value: 'Java', label: 'Java' },
  { value: 'C++', label: 'C++' },
  { value: 'DotnetCore', label: '.NET' },
];

const licenseOptions: SearchableSelectOption[] = [
  { value: 'mit', label: 'MIT' },
  { value: 'apache-2.0', label: 'Apache-2.0' },
  { value: 'agpl-3.0', label: 'AGPL-3.0' },
  { value: 'gpl-3.0', label: 'GPL-3.0' },
  { value: 'mpl-2.0', label: 'MPL-2.0' },
  { value: 'bsd-3-clause', label: 'BSD-3-Clause' },
  { value: 'unlicense', label: 'Unlicense' },
];

function encodeOwnerValue(payload: CreateGitHubRepoPayload['owner']): string {
  return `${payload.type}:${payload.login}`;
}

function decodeOwnerValue(value: string | null): CreateGitHubRepoPayload['owner'] | null {
  if (!value) {
    return null;
  }

  const [type, ...rest] = value.split(':');
  const login = rest.join(':').trim();

  if ((type !== 'personal' && type !== 'organization') || login.length === 0) {
    return null;
  }

  return {
    type,
    login,
  };
}

function CreateRepositoryDialog({
  open,
  activeAccount,
  orgs,
  submitStatus,
  error,
  onClose,
  onSubmit,
}: CreateRepositoryDialogProps) {
  const { t } = useTranslation('github');
  const [ownerValue, setOwnerValue] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CreateGitHubRepoPayload['visibility']>('public');
  const [initializeWithReadme, setInitializeWithReadme] = useState(false);
  const [gitignoreTemplate, setGitignoreTemplate] = useState<string | null>(null);
  const [licenseTemplate, setLicenseTemplate] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !activeAccount) {
      return;
    }

    setOwnerValue(encodeOwnerValue({ type: 'personal', login: activeAccount.login }));
    setName('');
    setDescription('');
    setVisibility('public');
    setInitializeWithReadme(false);
    setGitignoreTemplate(null);
    setLicenseTemplate(null);
    setValidationError(null);
  }, [activeAccount, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && submitStatus !== 'loading') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open, submitStatus]);

  if (!open || !activeAccount || typeof document === 'undefined') {
    return null;
  }

  const isSubmitting = submitStatus === 'loading';
  const ownerOptions: SearchableSelectOption[] = [
    {
      value: encodeOwnerValue({ type: 'personal', login: activeAccount.login }),
      label: `@${activeAccount.login}`,
      description: t('createDialog.ownerTypes.personal'),
    },
    ...orgs
      .slice()
      .sort((left, right) => left.login.localeCompare(right.login))
      .map((org) => ({
        value: encodeOwnerValue({ type: 'organization', login: org.login }),
        label: org.login,
        description: t('createDialog.ownerTypes.organization'),
      })),
  ];
  const dialogError = validationError ?? error;

  const submit = () => {
    const owner = decodeOwnerValue(ownerValue) ?? { type: 'personal' as const, login: activeAccount.login };
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setValidationError(t('createDialog.errors.nameRequired'));
      return;
    }

    setValidationError(null);
    onSubmit({
      owner,
      name: trimmedName,
      description: description.trim(),
      visibility,
      initializeWithReadme,
      gitignoreTemplate,
      licenseTemplate,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('createDialog.title')}
    >
      <div className="flex h-full w-full max-w-[46rem] flex-col border-l border-border/70 bg-[var(--surface-panel)]/98 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t('createDialog.title')}</h2>
            <p className="mt-1 max-w-[38rem] text-sm leading-6 text-muted-foreground">{t('createDialog.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting} aria-label={t('createDialog.close')}>
            <X />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5 pb-6">
            <section className="rounded-[1.5rem] border border-border/70 bg-background/20 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="create-repo-owner">
                    {t('createDialog.ownerLabel')}
                  </label>
                  <SearchableSelect
                    options={ownerOptions}
                    value={ownerValue}
                    onChange={(value) => {
                      setOwnerValue(value);
                      setValidationError(null);
                    }}
                    placeholder={t('createDialog.ownerPlaceholder')}
                    searchPlaceholder={t('createDialog.ownerSearchPlaceholder')}
                    emptyMessage={t('createDialog.ownerEmpty')}
                    disabled={isSubmitting}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="create-repo-name">
                    {t('createDialog.nameLabel')}
                  </label>
                  <Input
                    id="create-repo-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setValidationError(null);
                    }}
                    placeholder={t('createDialog.namePlaceholder')}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="create-repo-description">
                  {t('createDialog.descriptionLabel')}
                </label>
                <Input
                  id="create-repo-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('createDialog.descriptionPlaceholder')}
                  disabled={isSubmitting}
                />
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-border/70 bg-background/20 p-5">
              <p className="text-sm font-medium text-foreground">{t('createDialog.visibilityLabel')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { value: 'public' as const, icon: Globe2, title: t('createDialog.visibilityPublic'), description: t('createDialog.visibilityPublicHint') },
                  { value: 'private' as const, icon: Lock, title: t('createDialog.visibilityPrivate'), description: t('createDialog.visibilityPrivateHint') },
                ].map((option) => {
                  const Icon = option.icon;
                  const isActive = option.value === visibility;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'rounded-[1.25rem] border px-4 py-4 text-left transition-colors',
                        isActive
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border/70 bg-background/35 hover:bg-accent/30',
                      )}
                      onClick={() => setVisibility(option.value)}
                      disabled={isSubmitting}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn('mt-0.5 rounded-xl p-2', isActive ? 'bg-primary/20 text-primary' : 'bg-background/55 text-muted-foreground')}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{option.title}</span>
                            {isActive ? <span className="status-chip">{t('createDialog.selected')}</span> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-border/70 bg-background/20 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('createDialog.initializationTitle')}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('createDialog.initializationDescription')}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={initializeWithReadme}
                    onChange={(event) => setInitializeWithReadme(event.target.checked)}
                    disabled={isSubmitting}
                    className="size-4 rounded border border-border/70 bg-background/60 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  {t('createDialog.initializeWithReadme')}
                </label>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('createDialog.gitignoreLabel')}</label>
                  <SearchableSelect
                    options={gitignoreOptions}
                    value={gitignoreTemplate}
                    onChange={setGitignoreTemplate}
                    placeholder={t('createDialog.gitignorePlaceholder')}
                    searchPlaceholder={t('createDialog.gitignoreSearchPlaceholder')}
                    emptyMessage={t('createDialog.gitignoreEmpty')}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('createDialog.licenseLabel')}</label>
                  <SearchableSelect
                    options={licenseOptions}
                    value={licenseTemplate}
                    onChange={setLicenseTemplate}
                    placeholder={t('createDialog.licensePlaceholder')}
                    searchPlaceholder={t('createDialog.licenseSearchPlaceholder')}
                    emptyMessage={t('createDialog.licenseEmpty')}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {dialogError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {dialogError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/70 px-6 py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('createDialog.cancel')}
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
              {isSubmitting ? t('createDialog.creating') : t('createDialog.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CreateRepositoryDialog;
