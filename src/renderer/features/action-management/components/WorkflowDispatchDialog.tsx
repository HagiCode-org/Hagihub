import { useEffect } from 'react';
import { LoaderCircle, Play, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GitHubManagedWorkflow } from '../../../../shared/api';

interface WorkflowDispatchDialogProps {
  open: boolean;
  workflow: GitHubManagedWorkflow | null;
  formValues: Record<string, string>;
  submitStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  successMessage: string | null;
  onClose: () => void;
  onChange: (name: string, value: string) => void;
  onSubmit: () => void;
}

function WorkflowDispatchDialog({
  open,
  workflow,
  formValues,
  submitStatus,
  error,
  successMessage,
  onClose,
  onChange,
  onSubmit,
}: WorkflowDispatchDialogProps) {
  const { t } = useTranslation('github');

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

  if (!open || !workflow) {
    return null;
  }

  const renderInput = (name: string, value: string, options?: string[]) => {
    if (options && options.length > 0) {
      return (
        <select
          value={value}
          className="flex h-10 w-full rounded-lg border border-border/70 bg-background/45 px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
          onChange={(event) => onChange(name, event.target.value)}
        >
          <option value="">{t('actionManagement.dispatch.selectPlaceholder')}</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    return (
      <Input
        value={value}
        type="text"
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={t('actionManagement.dispatch.valuePlaceholder')}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,18,0.8)] px-4 py-6 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget && submitStatus !== 'loading') {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('actionManagement.dispatch.title')}
    >
      <div className="w-full max-w-2xl rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t('actionManagement.dispatch.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{workflow.workflowName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={submitStatus === 'loading'} aria-label={t('actionManagement.dispatch.close')}>
            <X />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="panel-muted p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.dispatch.repository')}</p>
              <p className="mt-3 font-mono text-sm text-foreground">{workflow.repoFullName}</p>
            </div>
            <div className="panel-muted p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('actionManagement.dispatch.targetRef')}</p>
              <p className="mt-3 font-mono text-sm text-foreground">{workflow.defaultBranch ?? t('actionManagement.dispatch.defaultRefFallback')}</p>
            </div>
          </div>

          {workflow.dispatchInputs.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {t('actionManagement.dispatch.noInputs')}
            </div>
          ) : (
            <div className="space-y-4">
              {workflow.dispatchInputs.map((input) => {
                const options = input.type === 'choice'
                  ? input.options
                  : input.type === 'boolean'
                    ? ['true', 'false']
                    : input.type === 'environment' && input.options.length > 0
                      ? input.options
                      : undefined;

                return (
                  <div key={input.name} className="rounded-2xl border border-border/70 bg-background/35 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm font-medium text-foreground">{input.name}</label>
                      {input.required ? (
                        <span className="status-chip">{t('actionManagement.dispatch.required')}</span>
                      ) : null}
                    </div>
                    {input.description ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{input.description}</p>
                    ) : null}
                    <div className="mt-3">
                      {renderInput(input.name, formValues[input.name] ?? '', options)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitStatus === 'loading'}>
              {t('actionManagement.dispatch.cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={submitStatus === 'loading'}>
              {submitStatus === 'loading' ? <LoaderCircle className="animate-spin" /> : <Play />}
              {submitStatus === 'loading'
                ? t('actionManagement.dispatch.submitting')
                : t('actionManagement.dispatch.submit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowDispatchDialog;
