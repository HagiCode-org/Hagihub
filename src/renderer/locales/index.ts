import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  detectInitialLanguage,
  persistLanguagePreference,
  resolveSupportedLanguage,
  type SupportedLanguage,
} from './metadata';

const localeModules = import.meta.glob('./generated-locales/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const resources = Object.entries(localeModules).reduce<Record<string, Record<string, Record<string, unknown>>>>(
  (acc, [modulePath, namespaceResources]) => {
    const match = modulePath.match(/^\.\/generated-locales\/([^/]+)\/([^/]+)\.json$/);
    if (!match) {
      return acc;
    }

    const [, language, namespace] = match;
    acc[language] ??= {};
    acc[language][namespace] = namespaceResources;
    return acc;
  },
  {},
);

const initialLanguage = detectInitialLanguage({
  storage: typeof window === 'undefined' ? null : window.localStorage,
  browserLanguage: typeof navigator === 'undefined' ? null : navigator.language,
});

function syncDocumentLanguage(language: string | null | undefined): SupportedLanguage {
  const resolvedLanguage = resolveSupportedLanguage(language);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = resolvedLanguage;
  }

  return resolvedLanguage;
}

function syncDocumentTitle(): void {
  if (typeof document === 'undefined' || !i18n.isInitialized) {
    return;
  }

  document.title = i18n.t('app.name');
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en-US',
  ns: ['common', 'error'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

syncDocumentLanguage(initialLanguage);

i18n.on('initialized', () => {
  syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
  syncDocumentTitle();
});

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  syncDocumentTitle();
});

export async function changeAppLanguage(language: SupportedLanguage): Promise<void> {
  persistLanguagePreference(language);
  await i18n.changeLanguage(language);
}

export default i18n;

export {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  getLanguageLabel,
  getLanguageShortLabel,
  resolveSupportedLanguage,
  type SupportedLanguage,
} from './metadata';
