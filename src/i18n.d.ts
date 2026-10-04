export function getLang(): string;
export function t(key: string): string;
export const setLang: (lang: string) => void;
export const translations: Record<string, Record<string, string>>;
