/** Country flag emoji per language code */
const LANG_FLAGS: Record<string, string> = {
  vi: '🇻🇳',
  en: '🇺🇸',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇧🇷',
  id: '🇮🇩',
  th: '🇹🇭',
};

interface Props {
  lang: string;
  className?: string;
}

export function LanguageFlag({ lang, className }: Props) {
  const flag = LANG_FLAGS[lang];
  if (!flag) return null;
  return <span className={className ?? 'text-sm leading-none shrink-0'}>{flag}</span>;
}
