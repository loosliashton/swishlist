const functions = require('firebase-functions');

// Get suggestions
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/generative-ai');
const apiKey = functions.config().gemini.key;
const gemini = new GoogleGenerativeAI(apiKey);

const model = gemini.getGenerativeModel({
  model: 'gemini-3.5-flash-lite',
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'application/json',
};

exports.getSuggestions = functions.https.onCall(
  async (data: { list: any }, context: any) => {
    const listPurpose =
      data.list?.type === 'general' ? 'a list' : 'a gift list';
    const parts = [
      { text: generateContentString(data.list) },
      {
        text: `I'm putting together ${listPurpose} and need suggestions on what to add. Make sure the suggestions are related to the list I provide. Provide at least one suggestion for every two items in the provided list. Provide your suggestions in the form of a JSON array in an object called 'suggestions'. Please return the following JSON for each suggestion: {name: string, description: string}. `,
      },
    ];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig,
    });

    return result;

    function generateContentString(list: any): string {
      let content =
        'Here is my current list of items. Please give me at least two suggestions (preferably more) to add to the list. \n';
      if (!list.items) return content;
      for (let item of list.items) {
        content += `Item: ${item.name}\n; `;
        if (item.url) content += `URL: ${item.url}\n`;
        if (item.description) content += `Description: ${item.description}\n`;
      }
      return content;
    }
  },
);

// Get Amazon links
const amazonAsin = require('amazon-asin');
const AMAZON_STORE_ID = 'swishlist0c-20';

exports.getAmazonLinks = functions.https.onCall(
  async (data: { url: string }, context: any) => {
    const result = await amazonAsin.asyncParseAsin(data.url);
    if (!result.ASIN) return { keepaUrl: '', affiliateUrl: data.url };
    let keepaUrl = `https://keepa.com/#!search/1-${result.ASIN}`;
    // Preserve any existing affiliate tags
    let affiliateUrl = data.url.includes('tag=')
      ? null
      : `https://www.amazon.com/dp/${result.ASIN}/ref=nosim?tag=${AMAZON_STORE_ID}`;
    return {
      keepaUrl,
      affiliateUrl,
    };
  },
);

// Get link metadata (price & thumbnail only)
const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_500_000;
const STEADYAPI_AMAZON_DETAILS_URL =
  'https://api.steadyapi.com/v1/amazon/products/details';

const AMAZON_TLD_TO_COUNTRY: Record<string, string> = {
  com: 'US',
  'co.uk': 'UK',
  uk: 'UK',
  ca: 'CA',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  'co.jp': 'JP',
  jp: 'JP',
  'com.au': 'AU',
  au: 'AU',
  'com.mx': 'MX',
  mx: 'MX',
  'com.br': 'BR',
  br: 'BR',
  in: 'IN',
  nl: 'NL',
  se: 'SE',
  pl: 'PL',
  sg: 'SG',
  ae: 'AE',
  sa: 'SA',
  'com.tr': 'TR',
  tr: 'TR',
  'com.be': 'BE',
  be: 'BE',
  eg: 'EG',
  ie: 'IE',
  'co.za': 'ZA',
  za: 'ZA',
  'com.ng': 'NG',
  ng: 'NG',
};

function getSteadyApiKey(): string | null {
  const envKey = process.env.STEADYAPI_KEY?.trim();
  if (envKey) return envKey;

  try {
    const configKey = functions.config()?.steadyapi?.key;
    if (typeof configKey === 'string' && configKey.trim()) {
      return configKey.trim();
    }
  } catch {
    // functions.config() may throw outside Firebase runtime if unconfigured
  }
  return null;
}

function isAmazonHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'a.co' ||
    host.endsWith('.a.co') ||
    host === 'amzn.to' ||
    host.endsWith('.amzn.to') ||
    host === 'amzn.com' ||
    host.endsWith('.amzn.com') ||
    /(?:^|\.)amazon\.[a-z.]{2,}$/i.test(host)
  );
}

function resolveAmazonCountry(tldOrUrl?: string): string {
  if (!tldOrUrl) return 'US';
  const normalized = tldOrUrl.toLowerCase().replace(/^\./, '');
  if (AMAZON_TLD_TO_COUNTRY[normalized]) {
    return AMAZON_TLD_TO_COUNTRY[normalized];
  }
  try {
    const host = new URL(tldOrUrl).hostname.toLowerCase();
    const match = host.match(/amazon\.([a-z.]{2,})$/i);
    if (match && AMAZON_TLD_TO_COUNTRY[match[1]]) {
      return AMAZON_TLD_TO_COUNTRY[match[1]];
    }
  } catch {
    // not a URL; fall back to default
  }
  return 'US';
}

async function parseAmazonTarget(
  rawUrl: string,
): Promise<{ asin: string; country: string } | null> {
  let resolvedUrl = rawUrl;
  let parsedAsin: string | undefined;
  let urlTld: string | undefined;

  try {
    const result = await amazonAsin.asyncParseAsin(rawUrl);
    if (result?.ASIN) {
      parsedAsin = String(result.ASIN).toUpperCase();
    }
    if (result?.url) {
      resolvedUrl = String(result.url);
    }
    if (result?.urlTld) {
      urlTld = String(result.urlTld);
    }
  } catch {
    // fall back to regex ASIN extraction
  }

  if (!parsedAsin) {
    const regexMatch =
      resolvedUrl.match(
        /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})(?:[/?&#]|$)/i,
      ) ||
      rawUrl.match(
        /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})(?:[/?&#]|$)/i,
      );
    if (regexMatch?.[1]) {
      parsedAsin = regexMatch[1].toUpperCase();
    }
  }

  if (!parsedAsin) return null;

  const country = resolveAmazonCountry(urlTld || resolvedUrl);
  return { asin: parsedAsin, country };
}

function pickSteadyApiImage(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    for (const entry of val) {
      const picked = pickSteadyApiImage(entry);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return (
      pickSteadyApiImage(obj['url']) ||
      pickSteadyApiImage(obj['hi_res']) ||
      pickSteadyApiImage(obj['large']) ||
      pickSteadyApiImage(obj['link']) ||
      pickSteadyApiImage(obj['src'])
    );
  }
  return null;
}

function pickSteadyApiPrice(body: Record<string, unknown>): string | null {
  const topCurrency =
    typeof body['currency'] === 'string' ? body['currency'] : null;

  const pricesObj = body['prices'];
  if (pricesObj && typeof pricesObj === 'object' && !Array.isArray(pricesObj)) {
    const p = pricesObj as Record<string, unknown>;
    const currency =
      (typeof p['currency'] === 'string' ? p['currency'] : null) ||
      (typeof p['symbol'] === 'string' ? p['symbol'] : null) ||
      topCurrency;

    const candidates = [
      p['current'],
      p['price'],
      p['value'],
      p['sale'],
      p['raw'],
      p['regular'],
    ];
    for (const candidate of candidates) {
      const formatted = formatPriceString(
        candidate as string | number | null | undefined,
        currency,
      );
      if (formatted) return formatted;
    }
  }

  const directPrice = body['price'];
  if (directPrice && typeof directPrice === 'object' && !Array.isArray(directPrice)) {
    const p = directPrice as Record<string, unknown>;
    const currency =
      (typeof p['currency'] === 'string' ? p['currency'] : null) ||
      (typeof p['symbol'] === 'string' ? p['symbol'] : null) ||
      topCurrency;
    const candidates = [p['current'], p['value'], p['raw'], p['amount']];
    for (const candidate of candidates) {
      const formatted = formatPriceString(
        candidate as string | number | null | undefined,
        currency,
      );
      if (formatted) return formatted;
    }
  }

  const scalarCandidates = [
    body['product_price'],
    body['price'],
    body['current_price'],
    body['sale_price'],
    body['buybox_price'],
    body['product_original_price'],
    body['product_price_max'],
  ];
  for (const candidate of scalarCandidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const formatted = formatPriceString(candidate, topCurrency);
      if (formatted) return formatted;
    }
  }

  return null;
}

async function fetchAmazonMetadataViaSteadyApi(
  target: { asin: string; country: string },
  apiKey: string,
): Promise<{ price: string | null; imageUrl: string | null }> {
  const endpoint = `${STEADYAPI_AMAZON_DETAILS_URL}?asin=${encodeURIComponent(
    target.asin,
  )}&country=${encodeURIComponent(target.country)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn(
        `SteadyAPI responded with HTTP ${response.status} for ${endpoint}: ${errBody.slice(0, 300)}`,
      );
      return { price: null, imageUrl: null };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const meta = payload?.['meta'] as Record<string, unknown> | undefined;
    if (meta?.['success'] === false || payload?.['success'] === false) {
      return { price: null, imageUrl: null };
    }

    const body = (payload?.['body'] ??
      payload?.['data'] ??
      payload) as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return { price: null, imageUrl: null };
    }

    const rawImage =
      pickSteadyApiImage(body['product_photos']) ||
      pickSteadyApiImage(body['photos']) ||
      pickSteadyApiImage(body['images']) ||
      pickSteadyApiImage(body['main_image']) ||
      pickSteadyApiImage(body['image']) ||
      pickSteadyApiImage(body['thumbnail']) ||
      pickSteadyApiImage(body['imageUrl']);

    const imageUrl = normalizeImageUrl(rawImage, 'https://www.amazon.com');
    const price = pickSteadyApiPrice(body);

    return { price, imageUrl };
  } catch (error) {
    console.warn('SteadyAPI Amazon lookup failed:', error);
    return { price: null, imageUrl: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface LinkMetadataResult {
  price: string | null;
  imageUrl: string | null;
  keepaUrl: string | null;
  affiliateUrl: string | null;
}

interface RawExtractedMetadata {
  price: string | null;
  currency: string | null;
  imageUrl: string | null;
}

function isDisallowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv6 private/link-local ranges
  if (host.includes(':')) {
    if (
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:127.') ||
      host.startsWith('::ffff:10.') ||
      host.startsWith('::ffff:192.168.') ||
      host.startsWith('::ffff:169.254.')
    ) {
      return true;
    }
    const v4Match = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Match) {
      return isPrivateIpv4(v4Match[1]);
    }
  }

  // IPv4 literal check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return isPrivateIpv4(host);
  }

  return false;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function validateSafeUrl(rawUrl: unknown): URL | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (isDisallowedHostname(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tag)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = decodeHtmlEntities(val.trim());
  }
  return attrs;
}

function normalizeImageUrl(rawUrl: string | null | undefined, baseUrl: string): string | null {
  if (!rawUrl) return null;
  const decoded = decodeHtmlEntities(rawUrl).trim();
  if (!decoded || decoded.startsWith('data:') || decoded.startsWith('javascript:')) {
    return null;
  }
  try {
    const resolved = new URL(decoded, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function formatPriceString(rawPrice: string | number | null | undefined, currency?: string | null): string | null {
  if (rawPrice === null || rawPrice === undefined) return null;
  const rawStr = decodeHtmlEntities(String(rawPrice)).trim();
  if (!rawStr) return null;

  // Check if rawStr already carries a clear currency symbol/prefix + numeric value
  const currencyMatch = rawStr.match(
    /((?:US|CA|AU|NZ|HK|SG)?\$|€|£|¥|₹|CHF|EUR|GBP|USD|CAD|AUD)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (currencyMatch) {
    const symbolOrCode = currencyMatch[1];
    const numPart = currencyMatch[2];
    const numeric = Number(numPart.replace(/,/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    const upper = symbolOrCode.toUpperCase();
    if (upper === 'USD') return `$${formatNumber(numeric)}`;
    if (upper === 'EUR') return `€${formatNumber(numeric)}`;
    if (upper === 'GBP') return `£${formatNumber(numeric)}`;
    if (upper === 'CAD') return `CA$${formatNumber(numeric)}`;
    if (upper === 'AUD') return `A$${formatNumber(numeric)}`;
    if (symbolOrCode.length <= 3 && !/^[A-Za-z]+$/.test(symbolOrCode)) {
      return `${symbolOrCode}${formatNumber(numeric)}`;
    }
    return `${upper} ${formatNumber(numeric)}`;
  }

  // Otherwise parse plain number (handle comma decimal if European like 29,99 without period)
  let cleaned = rawStr.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  if (/^\d+,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const formattedNum = formatNumber(numeric);
  const curr = (currency || '').trim().toUpperCase();

  if (!curr || curr === 'USD' || curr === '$') return `$${formattedNum}`;
  if (curr === 'EUR' || curr === '€') return `€${formattedNum}`;
  if (curr === 'GBP' || curr === '£') return `£${formattedNum}`;
  if (curr === 'CAD') return `CA$${formattedNum}`;
  if (curr === 'AUD') return `A$${formattedNum}`;
  if (curr === 'JPY' || curr === '¥') return `¥${Math.round(numeric).toLocaleString('en-US')}`;
  if (curr === 'INR' || curr === '₹') return `₹${formattedNum}`;
  return `${curr} ${formattedNum}`;
}

function formatNumber(numeric: number): string {
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pickImageFromJsonLdValue(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    for (const item of val) {
      const picked = pickImageFromJsonLdValue(item);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return (
      pickImageFromJsonLdValue(obj['url']) ||
      pickImageFromJsonLdValue(obj['contentUrl']) ||
      pickImageFromJsonLdValue(obj['thumbnailUrl'])
    );
  }
  return null;
}

function extractOfferPrice(offers: unknown): { price: string | null; currency: string | null } {
  if (!offers) return { price: null, currency: null };
  if (Array.isArray(offers)) {
    for (const offer of offers) {
      const res = extractOfferPrice(offer);
      if (res.price) return res;
    }
    return { price: null, currency: null };
  }
  if (typeof offers !== 'object') return { price: null, currency: null };

  const obj = offers as Record<string, unknown>;
  const directCurrency =
    typeof obj['priceCurrency'] === 'string' ? obj['priceCurrency'] : null;

  const rawPrice = obj['price'] ?? obj['lowPrice'] ?? obj['highPrice'];
  if (rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== '') {
    const formatted = formatPriceString(rawPrice as string | number, directCurrency);
    if (formatted) {
      return { price: String(rawPrice), currency: directCurrency };
    }
  }

  const priceSpec = obj['priceSpecification'];
  if (priceSpec) {
    const specs = Array.isArray(priceSpec) ? priceSpec : [priceSpec];
    for (const spec of specs) {
      if (spec && typeof spec === 'object') {
        const s = spec as Record<string, unknown>;
        const specCurr =
          typeof s['priceCurrency'] === 'string' ? s['priceCurrency'] : directCurrency;
        const specPrice = s['price'] ?? s['minPrice'] ?? s['maxPrice'];
        if (specPrice !== undefined && specPrice !== null && String(specPrice).trim() !== '') {
          const formatted = formatPriceString(specPrice as string | number, specCurr);
          if (formatted) {
            return { price: String(specPrice), currency: specCurr };
          }
        }
      }
    }
  }

  if (obj['offers']) {
    return extractOfferPrice(obj['offers']);
  }

  return { price: null, currency: directCurrency };
}

function matchesJsonLdType(typeVal: unknown, targets: string[]): boolean {
  if (!typeVal) return false;
  const list = Array.isArray(typeVal) ? typeVal : [typeVal];
  return list.some((entry) => {
    if (typeof entry !== 'string') return false;
    const localName = entry.split(/[\/#]/).pop() || entry;
    return targets.includes(localName);
  });
}

function extractFromJsonLd(html: string): RawExtractedMetadata {
  const result: RawExtractedMetadata = { price: null, currency: null, imageUrl: null };
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json[^"'>\s]*["']?[^>]*>([\s\S]*?)<\/script>/gi;

  const productTypes = ['Product', 'IndividualProduct', 'ProductGroup'];
  const offerTypes = ['Offer', 'AggregateOffer'];

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      continue;
    }

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }

      const obj = node as Record<string, unknown>;
      if (matchesJsonLdType(obj['@type'], productTypes)) {
        if (!result.imageUrl) {
          result.imageUrl = pickImageFromJsonLdValue(obj['image']);
        }
        if (!result.price && obj['offers']) {
          const offerRes = extractOfferPrice(obj['offers']);
          if (offerRes.price) {
            result.price = offerRes.price;
            result.currency = offerRes.currency;
          }
        }
      } else if (matchesJsonLdType(obj['@type'], offerTypes)) {
        if (!result.price) {
          const offerRes = extractOfferPrice(obj);
          if (offerRes.price) {
            result.price = offerRes.price;
            result.currency = offerRes.currency;
          }
        }
        if (!result.imageUrl && obj['image']) {
          result.imageUrl = pickImageFromJsonLdValue(obj['image']);
        }
      }

      if (obj['@graph']) {
        visit(obj['@graph']);
      }
      if (obj['mainEntity']) {
        visit(obj['mainEntity']);
      }
    };

    visit(parsed);
    if (result.price && result.imageUrl) break;
  }

  return result;
}

function extractFromMetaTags(html: string): RawExtractedMetadata {
  const metaMap = new Map<string, string>();
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = parseAttributes(match[0]);
    const content = attrs['content'];
    if (!content) continue;

    const keys = [attrs['property'], attrs['name'], attrs['itemprop']]
      .filter((k): k is string => Boolean(k))
      .map((k) => k.toLowerCase());

    for (const key of keys) {
      if (!metaMap.has(key)) {
        metaMap.set(key, content);
      }
    }
  }

  const imagePriority = [
    'og:image:secure_url',
    'og:image',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
    'image',
  ];
  let imageUrl: string | null = null;
  for (const key of imagePriority) {
    if (metaMap.has(key)) {
      imageUrl = metaMap.get(key)!;
      break;
    }
  }

  const currency =
    metaMap.get('product:price:currency') ||
    metaMap.get('og:price:currency') ||
    metaMap.get('pricecurrency') ||
    null;

  let price: string | null =
    metaMap.get('product:price:amount') ||
    metaMap.get('og:price:amount') ||
    metaMap.get('product:price') ||
    metaMap.get('og:price') ||
    metaMap.get('price') ||
    null;

  if (!price && metaMap.has('twitter:data1')) {
    const label1 = (metaMap.get('twitter:label1') || '').toLowerCase();
    const data1 = metaMap.get('twitter:data1')!;
    if (label1.includes('price') || /^[$€£¥₹]|USD|EUR|GBP/i.test(data1)) {
      price = data1;
    }
  }

  return { price, currency, imageUrl };
}

function extractDomFallbacks(html: string): RawExtractedMetadata {
  let imageUrl: string | null = null;
  let price: string | null = null;

  // Amazon landingImage / imgBlkFront
  const imgTagRegex = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    const attrs = parseAttributes(imgMatch[0]);
    const id = (attrs['id'] || '').toLowerCase();
    if (id === 'landingimage' || id === 'imgblkfront') {
      if (attrs['data-old-hires']) {
        imageUrl = attrs['data-old-hires'];
      } else if (attrs['data-a-dynamic-image']) {
        try {
          const parsed = JSON.parse(attrs['data-a-dynamic-image']);
          const firstUrl = Object.keys(parsed)[0];
          if (firstUrl) imageUrl = firstUrl;
        } catch {
          // ignore malformed dynamic image JSON
        }
      }
      if (!imageUrl && attrs['src']) {
        imageUrl = attrs['src'];
      }
      if (imageUrl) break;
    }
  }

  // <link rel="image_src" href="...">
  if (!imageUrl) {
    const linkRegex = /<link\b[^>]*>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const attrs = parseAttributes(linkMatch[0]);
      if ((attrs['rel'] || '').toLowerCase() === 'image_src' && attrs['href']) {
        imageUrl = attrs['href'];
        break;
      }
    }
  }

  // Amazon .a-price .a-offscreen
  const aPriceMatch = html.match(
    /class=["'][^"']*\ba-price\b[^"']*["'][^>]*>[\s\S]{0,600}?<span[^>]*class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  if (aPriceMatch && aPriceMatch[1]) {
    price = aPriceMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // Amazon #priceblock_ourprice / #priceblock_dealprice
  if (!price) {
    const blockMatch = html.match(
      /id=["'](?:priceblock_ourprice|priceblock_dealprice)["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    );
    if (blockMatch && blockMatch[1]) {
      price = blockMatch[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  // Generic itemprop="price" or data-price fallback
  if (!price) {
    const itemPropMatch = html.match(
      /<[a-z0-9]+\b[^>]*itemprop=["']price["'][^>]*?(?:content=["']([^"']+)["'][^>]*>|>\s*([^<]{1,40})\s*<)/i,
    );
    if (itemPropMatch) {
      price = (itemPropMatch[1] || itemPropMatch[2] || '').trim();
    }
  }

  if (!price) {
    const dataPriceMatch = html.match(/\bdata-price=["']([^"']{1,40})["']/i);
    if (dataPriceMatch && dataPriceMatch[1]) {
      price = dataPriceMatch[1].trim();
    }
  }

  return { price, currency: null, imageUrl };
}

async function readHtmlCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let html = '';
  let bytesRead = 0;

  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors
    }
  }

  return html;
}

exports.getLinkMetadata = functions.https.onCall(
  async (data: { url: string }, _context: any): Promise<LinkMetadataResult> => {
    const targetUrl = validateSafeUrl(data?.url);
    if (!targetUrl) {
      return { price: null, imageUrl: null, keepaUrl: null, affiliateUrl: null };
    }

    let keepaUrl: string | null = null;
    let affiliateUrl: string | null = null;
    let steadyResult: { price: string | null; imageUrl: string | null } = {
      price: null,
      imageUrl: null,
    };

    if (isAmazonHost(targetUrl.hostname)) {
      const amazonTarget = await parseAmazonTarget(targetUrl.toString());
      if (amazonTarget) {
        keepaUrl = `https://keepa.com/#!search/1-${amazonTarget.asin}`;
        affiliateUrl = targetUrl.toString().includes('tag=')
          ? null
          : `https://www.amazon.com/dp/${amazonTarget.asin}/ref=nosim?tag=${AMAZON_STORE_ID}`;

        const steadyApiKey = getSteadyApiKey();
        if (steadyApiKey) {
          steadyResult = await fetchAmazonMetadataViaSteadyApi(
            amazonTarget,
            steadyApiKey,
          );
          if (steadyResult.price && steadyResult.imageUrl) {
            return {
              price: steadyResult.price,
              imageUrl: steadyResult.imageUrl,
              keepaUrl,
              affiliateUrl,
            };
          }
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const finalUrl = response.url || targetUrl.toString();
      if (!validateSafeUrl(finalUrl)) {
        return { ...steadyResult, keepaUrl, affiliateUrl };
      }

      if (!response.ok) {
        return { ...steadyResult, keepaUrl, affiliateUrl };
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        contentType &&
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        return { ...steadyResult, keepaUrl, affiliateUrl };
      }

      const html = await readHtmlCapped(response, MAX_HTML_BYTES);
      if (!html) {
        return { ...steadyResult, keepaUrl, affiliateUrl };
      }

      const jsonLd = extractFromJsonLd(html);
      const meta = extractFromMetaTags(html);
      const dom = extractDomFallbacks(html);

      const rawImage = jsonLd.imageUrl || meta.imageUrl || dom.imageUrl;
      const scrapedImageUrl = normalizeImageUrl(rawImage, finalUrl);

      const candidates: Array<{ raw: string | null; currency: string | null }> = [
        { raw: jsonLd.price, currency: jsonLd.currency || meta.currency },
        { raw: meta.price, currency: meta.currency || jsonLd.currency },
        { raw: dom.price, currency: meta.currency || jsonLd.currency },
      ];

      let scrapedPrice: string | null = null;
      for (const candidate of candidates) {
        const formatted = formatPriceString(candidate.raw, candidate.currency);
        if (formatted) {
          scrapedPrice = formatted;
          break;
        }
      }

      return {
        price: steadyResult.price || scrapedPrice,
        imageUrl: steadyResult.imageUrl || scrapedImageUrl,
        keepaUrl,
        affiliateUrl,
      };
    } catch (error) {
      console.warn('getLinkMetadata failed:', error);
      return { ...steadyResult, keepaUrl, affiliateUrl };
    } finally {
      clearTimeout(timeoutId);
    }
  },
);
