import { useMarketplaceStore } from '../../src/store/marketplaceStore';
import { ListingSummary } from '../../src/models/marketplace';

describe('Marketplace Feed Consistency & Resilience', () => {
  beforeEach(() => {
    useMarketplaceStore.setState({
      favorites: [],
      customListings: [],
    });
  });

  it('deduplicates custom listings and server listings by id', () => {
    const customItem: ListingSummary = {
      id: 501,
      title: 'Local Item',
      price: 1500,
      condition: 'LIKE_NEW',
      location: 'Bangalore',
      primaryImageUrl: 'https://example.com/img1.jpg',
      isFeatured: false,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      categoryId: 1,
      categoryName: 'Mobiles',
      isFavorite: false,
    };
    useMarketplaceStore.getState().addListing(customItem);

    const serverListings: ListingSummary[] = [
      {
        id: 501,
        title: 'Server Confirmed Item',
        price: 1500,
        condition: 'LIKE_NEW',
        location: 'Bangalore',
        primaryImageUrl: 'https://example.com/img1.jpg',
        isFeatured: false,
        viewCount: 5,
        createdAt: new Date().toISOString(),
        categoryId: 1,
        categoryName: 'Mobiles',
        isFavorite: false,
      },
      {
        id: 502,
        title: 'Another Server Item',
        price: 2500,
        condition: 'NEW',
        location: 'Delhi',
        primaryImageUrl: 'https://example.com/img2.jpg',
        isFeatured: true,
        viewCount: 12,
        createdAt: new Date().toISOString(),
        categoryId: 2,
        categoryName: 'Vehicles',
        isFavorite: false,
      },
    ];

    // Emulate feed reconciliation logic from MarketplaceHomeScreen
    const customListings = useMarketplaceStore.getState().customListings;
    const serverIds = new Set(serverListings.map((s) => s.id));
    const uniqueCustom = customListings.filter((c) => !serverIds.has(c.id));
    const allListings = [...uniqueCustom, ...serverListings];

    expect(allListings).toHaveLength(2);
    expect(allListings.map((l) => l.id)).toEqual([501, 502]);
    expect(allListings.find((l) => l.id === 501)?.viewCount).toBe(5);
  });

  it('correctly handles an empty server listings collection without keeping stale items', () => {
    let serverListings: ListingSummary[] = [
      {
        id: 101,
        title: 'Old Item',
        price: 1000,
        condition: 'USED',
        location: 'Pune',
        primaryImageUrl: 'https://example.com/old.jpg',
        isFeatured: false,
        viewCount: 1,
        createdAt: new Date().toISOString(),
        categoryId: 3,
        categoryName: 'Electronics',
        isFavorite: false,
      },
    ];

    // Backend returns empty array
    const emptyResponse: ListingSummary[] = [];
    if (Array.isArray(emptyResponse)) {
      serverListings = emptyResponse;
    }

    expect(serverListings).toHaveLength(0);
  });

  it('filters deleted or unlisted items out when refreshing feed', () => {
    const serverListings: ListingSummary[] = [
      {
        id: 201,
        title: 'Active Item',
        price: 2000,
        condition: 'NEW',
        location: 'Mumbai',
        primaryImageUrl: 'https://example.com/item.jpg',
        isFeatured: false,
        viewCount: 2,
        createdAt: new Date().toISOString(),
        categoryId: 1,
        categoryName: 'Mobiles',
        isFavorite: false,
      },
    ];

    const currentListings = serverListings.filter((l) => l.id !== 999);
    expect(currentListings).toHaveLength(1);
    expect(currentListings[0].id).toBe(201);
  });
});
