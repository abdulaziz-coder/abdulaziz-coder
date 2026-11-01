import { describe, expect, it, vi, afterEach } from 'vitest';
import { languages, translate, uz, ru } from './translations';
import { previewStages, stageSchema } from './schemas';
import { readSavedLocale } from './i18n';

afterEach(() => vi.unstubAllGlobals());
describe('school languages', () => {
  it('offers English, Uzbek and Russian with complete matching dictionaries', () => {
    expect(languages.map(language => language.code)).toEqual(['uz', 'en', 'ru']);
    expect(Object.keys(uz).sort()).toEqual(Object.keys(ru).sort());
    for (const value of [...Object.values(uz), ...Object.values(ru)]) expect(value.trim().length).toBeGreaterThan(0);
  });
  it('translates the complete learning catalog while preserving canonical API values', () => {
    for (const stage of previewStages) {
      for (const text of [stage.name, stage.eyebrow, stage.title, stage.description, ...stage.highlights]) {
        expect(translate('uz', text)).not.toBe(text);
        expect(translate('ru', text)).not.toBe(text);
      }
      expect(stageSchema.safeParse(stage.name).success).toBe(true);
      expect(stageSchema.safeParse(translate('uz', stage.name)).success).toBe(false);
    }
  });
  it('keeps English and safely falls back for unknown API content', () => {
    expect(translate('en', 'Learning')).toBe('Learning');
    expect(translate('ru', 'New API content')).toBe('New API content');
  });
  it.each(['uz', 'ru', 'en'] as const)('restores the saved %s language', locale => {
    vi.stubGlobal('localStorage', { getItem: () => locale });
    expect(readSavedLocale()).toBe(locale);
  });
  it('handles invalid preferences and blocked storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readSavedLocale()).toBe('uz');
    vi.stubGlobal('localStorage', { getItem: () => 'invalid' });
    expect(readSavedLocale()).toBe('uz');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readSavedLocale()).toBe('uz');
  });
});
