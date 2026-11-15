export interface Item {
  name: string;
  url: string;
  camelUrl?: string | null;
  affiliateUrl?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  purchased: boolean;
  details: string;
}
