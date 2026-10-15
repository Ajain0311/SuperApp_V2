import { absoluteImageUrl } from '../../src/services/documentService';

describe('Food and Restaurant Data Integrity & Empty States', () => {
  it('correctly distinguishes empty backend menu items from populated inventory', () => {
    const rawBackendCategories: any[] = [];
    const fromCategories = rawBackendCategories.flatMap((cat: any) => cat.items || []);
    expect(fromCategories).toHaveLength(0);
  });

  it('correctly maps backend food item IDs, prices and veg attributes', () => {
    const backendData = {
      id: 10,
      name: 'Curry Point',
      categories: [
        {
          id: 1,
          name: 'Main Course',
          items: [
            {
              id: 42,
              name: 'Butter Chicken',
              discountedPrice: 320,
              basePrice: 350,
              description: 'Rich tomato cashew gravy',
              isVeg: false,
              isBestseller: true,
              variants: [],
              addons: [],
              imageUrl: 'https://example.com/dish.jpg',
            },
            {
              id: 43,
              name: 'Dal Makhani',
              discountedPrice: null,
              basePrice: 240,
              description: 'Slow cooked black lentils',
              isVeg: true,
              isBestseller: false,
              variants: [{ id: 1, name: 'Half' }],
              addons: [],
              imageUrl: null,
            },
          ],
        },
      ],
    };

    const mapped = backendData.categories.flatMap((cat: any) =>
      (cat.items || []).map((it: any) => ({
        id: it.id,
        name: it.name,
        category: cat.name,
        price: it.discountedPrice || it.basePrice,
        description: it.description || '',
        isVeg: Boolean(it.isVeg),
        isBestseller: Boolean(it.isBestseller),
        isCustomizable: Boolean(it.variants?.length || it.addons?.length),
        image: it.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
      }))
    );

    expect(mapped).toHaveLength(2);
    expect(mapped[0].id).toBe(42);
    expect(mapped[0].price).toBe(320);
    expect(mapped[0].isVeg).toBe(false);
    expect(mapped[0].isCustomizable).toBe(false);

    expect(mapped[1].id).toBe(43);
    expect(mapped[1].price).toBe(240);
    expect(mapped[1].isVeg).toBe(true);
    expect(mapped[1].isCustomizable).toBe(true);
  });

  it('resolves relative image URLs to backend host or keeps CDN URLs intact', () => {
    const cdnUrl = 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300';
    expect(absoluteImageUrl(cdnUrl)).toBe(cdnUrl);

    const relativeUrl = '/uploads/dish1.jpg';
    const resolved = absoluteImageUrl(relativeUrl);
    expect(resolved).toContain('/uploads/dish1.jpg');
    expect(resolved.startsWith('http')).toBe(true);
  });
});
