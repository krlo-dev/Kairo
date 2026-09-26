import type { Currency, Source, TrackedProduct } from '@prisma/client';

export interface AddTrackingInput {
  externalId: string;
  source: Source;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  currentPrice: number;
  currency: Currency;
  country: string;
}

export interface TrackingListResult {
  data: TrackedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PricePoint {
  recordedAt: Date;
  price: number;
  currency: Currency;
}
