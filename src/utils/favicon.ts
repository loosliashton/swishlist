import { Item } from 'src/models/item';

export function getFaviconUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
  } catch {
    return null;
  }
}

export function getItemFaviconUrl(
  item?: Pick<Item, 'url' | 'affiliateUrl'> | null,
): string | null {
  if (!item?.url) return null;
  return getFaviconUrl(item.affiliateUrl || item.url);
}
