export interface MarketplaceCategory {
  id: number;
  name: string;
  iconUrl?: string | null;
  listingCount?: number;
}

export interface ListingSummary {
  id: number;
  title: string;
  price: number;
  condition: string;
  location?: string | null;
  primaryImageUrl?: string | null;
  isFeatured: boolean;
  viewCount: number;
  status?: string;
  createdAt: string;
  categoryId: number;
  categoryName: string;
  isFavorite: boolean;
}

export interface ListingDetail {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  condition: string;
  location?: string | null;
  latitude?: number;
  longitude?: number;
  status?: string;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  categoryId: number;
  categoryName: string;
  sellerId: number;
  sellerName: string;
  sellerPhone?: string | null;
  sellerAvatar?: string | null;
  sellerRating?: number;
  dealsCount?: number;
  sellerJoinedAt?: string | null;
  isFavorite: boolean;
  images: string[];
}

export interface ListingActionRequest {
  action: 'ADD' | 'EDIT' | 'DELETE' | 'STATUS';
  id?: number;
  title?: string;
  description?: string;
  price?: number;
  condition?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  categoryId?: number;
  status?: string;
  imageUrls?: string[];
}
