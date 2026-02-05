import { writable, derived } from 'svelte/store';
import en from './en';
import es from './es';

export type Locale = 'en' | 'es';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, es };

function getInitialLocale(): Locale {
	if (typeof window === 'undefined') return 'en';
	const stored = localStorage.getItem('locale');
	if (stored === 'en' || stored === 'es') return stored;
	return 'en';
}

function createLocaleStore() {
	const { subscribe, set, update } = writable<Locale>(getInitialLocale());

	return {
		subscribe,
		set: (value: Locale) => {
			if (typeof window !== 'undefined') {
				localStorage.setItem('locale', value);
			}
			set(value);
		},
		update
	};
}

export const locale = createLocaleStore();

export const t = derived(locale, ($locale) => translations[$locale]);

export function setLocale(lang: Locale) {
	locale.set(lang);
}
