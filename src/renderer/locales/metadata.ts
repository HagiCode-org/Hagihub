export const LANGUAGE_STORAGE_KEY = 'hagihub.language';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文', shortLabel: '中文' },
  { code: 'en-US', label: 'English', shortLabel: 'EN' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  en: 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-US',
};

export function normalizeLanguageAlias(language: string | null | undefined): SupportedLanguage | null {
  if (!language) {
    return null;
  }

  const normalized = language.trim().toLowerCase();
  if (LANGUAGE_ALIASES[normalized]) {
    return LANGUAGE_ALIASES[normalized];
  }

  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }

  if (normalized.startsWith('en')) {
    return 'en-US';
  }

  return null;
}

export function resolveSupportedLanguage(language: string | null | undefined): SupportedLanguage {
  return normalizeLanguageAlias(language) ?? 'en-US';
}

export function detectInitialLanguage(options?: {
  storage?: Pick<Storage, 'getItem'> | null;
  browserLanguage?: string | null;
}): SupportedLanguage {
  const storedLanguage = options?.storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  const storedResolved = normalizeLanguageAlias(storedLanguage);

  if (storedResolved) {
    return storedResolved;
  }

  return resolveSupportedLanguage(options?.browserLanguage ?? null);
}

export function persistLanguagePreference(
  language: SupportedLanguage,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  storage?.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function getLanguageLabel(language: SupportedLanguage): string {
  return SUPPORTED_LANGUAGES.find((option) => option.code === language)?.label ?? language;
}

export function getLanguageShortLabel(language: SupportedLanguage): string {
  return SUPPORTED_LANGUAGES.find((option) => option.code === language)?.shortLabel ?? language;
}
