import { useMarketplaceStore } from '../../src/store/marketplaceStore';
import { ListingSummary } from '../../src/models/marketplace';

describe('MarketplaceStore - Ad Creation & Favorite State', () => {
  beforeEach(() => {
    useMarketplaceStore.setState({
      favorites: [102],
      customListings: [],
    });
  });

  it('should toggle favorites on and off', () => {
    expect(useMarketplaceStore.getState().isFavorite(102)).toBe(true);

    // Toggle off
    const isNowFav = useMarketplaceStore.getState().toggleFavorite(102);
    expect(isNowFav).toBe(false);
    expect(useMarketplaceStore.getState().isFavorite(102)).toBe(false);

    // Toggle on
    const isFavAgain = useMarketplaceStore.getState().toggleFavorite(102);
    expect(isFavAgain).toBe(true);
    expect(useMarketplaceStore.getState().isFavorite(102)).toBe(true);
  });

  it('should prepend custom listing to customListings array', () => {
    const newListing: ListingSummary = {
      id: 999,
      title: 'Sony WH-1000XM5 Headphones',
      price: 19999,
      condition: 'LIKE_NEW',
      location: 'Indiranagar, Bengaluru',
      primaryImageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400',
      isFeatured: false,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      categoryId: 3,
      categoryName: 'Electronics',
      isFavorite: false,
    };

    useMarketplaceStore.getState().addListing(newListing);

    const listings = useMarketplaceStore.getState().customListings;
    expect(listings).toHaveLength(1);
    expect(listings[0].title).toBe('Sony WH-1000XM5 Headphones');
    expect(listings[0].id).toBe(999);
  });
});
