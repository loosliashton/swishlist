import { getFaviconUrl, getItemFaviconUrl } from './favicon';

describe('favicon utilities', () => {
  describe('getFaviconUrl', () => {
    it('returns null for empty, null, or undefined URLs', () => {
      expect(getFaviconUrl('')).toBeNull();
      expect(getFaviconUrl(null)).toBeNull();
      expect(getFaviconUrl(undefined)).toBeNull();
    });

    it('returns null for invalid URLs or non-http(s) protocols', () => {
      expect(getFaviconUrl('not-a-url')).toBeNull();
      expect(getFaviconUrl('javascript:alert(1)')).toBeNull();
      expect(getFaviconUrl('mailto:test@example.com')).toBeNull();
      expect(getFaviconUrl('ftp://example.com/file')).toBeNull();
    });

    it('builds a Google S2 favicon URL from the hostname of valid http/https URLs', () => {
      expect(getFaviconUrl('https://www.target.com/p/some-item')).toBe(
        'https://www.google.com/s2/favicons?domain=www.target.com&sz=64',
      );
      expect(getFaviconUrl('http://example.org:8080/path?q=1')).toBe(
        'https://www.google.com/s2/favicons?domain=example.org&sz=64',
      );
    });

    it('trims surrounding whitespace before parsing', () => {
      expect(getFaviconUrl('  https://store.steampowered.com/app/123  ')).toBe(
        'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=64',
      );
    });
  });

  describe('getItemFaviconUrl', () => {
    it('returns null when item has no url', () => {
      expect(getItemFaviconUrl(null)).toBeNull();
      expect(getItemFaviconUrl({ url: '' })).toBeNull();
      expect(
        getItemFaviconUrl({
          url: '',
          affiliateUrl: 'https://www.amazon.com/dp/B001',
        }),
      ).toBeNull();
    });

    it('prefers affiliateUrl over url so shortened Amazon links resolve to amazon.com', () => {
      expect(
        getItemFaviconUrl({
          url: 'https://a.co/d/abc123',
          affiliateUrl:
            'https://www.amazon.com/dp/B001/ref=nosim?tag=swishlist0c-20',
        }),
      ).toBe('https://www.google.com/s2/favicons?domain=www.amazon.com&sz=64');
    });

    it('falls back to item.url when affiliateUrl is not set', () => {
      expect(
        getItemFaviconUrl({
          url: 'https://www.etsy.com/listing/12345',
          affiliateUrl: null,
        }),
      ).toBe('https://www.google.com/s2/favicons?domain=www.etsy.com&sz=64');
    });
  });
});
