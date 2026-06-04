import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  getLanguageShortLabel,
  resolveSupportedLanguage,
} from '@/locales';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common');
  const [isPending, startLanguageTransition] = useTransition();
  const currentLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/45 p-1.5">
      <div className="flex items-center gap-2 px-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Languages className="size-3.5" />
        <span>{t('language.label')}</span>
      </div>

      <div className="flex items-center gap-1">
        {SUPPORTED_LANGUAGES.map((option) => {
          const isActive = option.code === currentLanguage;

          return (
            <Button
              key={option.code}
              type="button"
              size="sm"
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('min-w-14 rounded-xl px-3', !isActive && 'text-muted-foreground')}
              disabled={isPending}
              title={option.label}
              onClick={() => {
                startLanguageTransition(() => {
                  void changeAppLanguage(option.code);
                });
              }}
            >
              {getLanguageShortLabel(option.code)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default LanguageSwitcher;
