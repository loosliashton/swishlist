export interface Item {
  name: string;
  url: string;
  camelUrl?: string | null;
  affiliateUrl?: string | null;
  purchased: boolean;
  details: string;
}
