import { describe, it, expect } from 'vitest';
import { buildAlternates } from './seo';
import { SITE_URL } from '@/lib/constants';

describe('buildAlternates', () => {
  it('defaults to including every locale and canonicaling at the requested locale', () => {
    const result = buildAlternates('en', '/posts/hello');

    expect(result.canonical).toBe(`${SITE_URL}/en/posts/hello`);
    expect(result.languages.en).toBe(`${SITE_URL}/en/posts/hello`);
    expect(result.languages.pt).toBe(`${SITE_URL}/pt/posts/hello`);
    expect(result.languages['x-default']).toBe(`${SITE_URL}/pt/posts/hello`);
  });

  it('drops the en entry when includeEn is false', () => {
    const result = buildAlternates('en', '/posts/hello', { includeEn: false });

    expect(result.languages.en).toBeUndefined();
    expect(result.languages.pt).toBe(`${SITE_URL}/pt/posts/hello`);
  });

  it('canonicals at a different locale when canonicalLocale is set', () => {
    const result = buildAlternates('en', '/posts/hello', {
      includeEn: false,
      canonicalLocale: 'pt',
    });

    expect(result.canonical).toBe(`${SITE_URL}/pt/posts/hello`);
  });

  it('matches the pre-existing unqualified call shape used by About/Support', () => {
    const withOptions = buildAlternates('pt', '/about');
    const withoutOptions = buildAlternates('pt', '/about', undefined);

    expect(withOptions).toEqual(withoutOptions);
  });
});
