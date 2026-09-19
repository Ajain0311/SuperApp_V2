import { reviewService } from '../../src/services/reviewService';
import { apiClient } from '../../src/services/apiClient';

jest.mock('../../src/services/apiClient');

describe('ReviewService - Reviews and Ratings API Contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits a 5-star review for a restaurant successfully', async () => {
    const mockResponse = {
      id: 1,
      userId: 42,
      userName: 'Aditya',
      targetType: 'RESTAURANT',
      targetId: 10,
      rating: 5,
      comment: 'Super fast delivery and fresh food!',
      createdAt: '2026-09-19T10:00:00Z',
    };

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: mockResponse,
    });

    const result = await reviewService.submitReview({
      targetType: 'RESTAURANT',
      targetId: 10,
      rating: 5,
      comment: 'Super fast delivery and fresh food!',
    });

    expect(result.id).toBe(1);
    expect(result.rating).toBe(5);
    expect(result.targetType).toBe('RESTAURANT');
    expect(apiClient.post).toHaveBeenCalledWith('/reviews', {
      targetType: 'RESTAURANT',
      targetId: 10,
      rating: 5,
      comment: 'Super fast delivery and fresh food!',
    });
  });

  it('fetches reviews for a specific target', async () => {
    const mockReviews = [
      {
        id: 1,
        userId: 101,
        userName: 'Priya',
        targetType: 'DRIVER',
        targetId: 5,
        rating: 5,
        comment: 'Very polite and drove safely.',
        createdAt: '2026-09-19T09:30:00Z',
      },
      {
        id: 2,
        userId: 102,
        userName: 'Rohan',
        targetType: 'DRIVER',
        targetId: 5,
        rating: 4,
        comment: 'Good ride.',
        createdAt: '2026-09-19T08:15:00Z',
      },
    ];

    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: mockReviews,
    });

    const result = await reviewService.getReviews('DRIVER', 5);
    expect(result).toHaveLength(2);
    expect(result[0].userName).toBe('Priya');
    expect(result[1].rating).toBe(4);
    expect(apiClient.get).toHaveBeenCalledWith('/reviews?targetType=DRIVER&targetId=5');
  });
});
