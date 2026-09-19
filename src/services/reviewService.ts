import { apiClient } from './apiClient';
import { ApiEndpoints } from '../constants/api';

export interface ReviewItem {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  targetType: string;
  targetId: number;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CreateReviewPayload {
  targetType: 'RESTAURANT' | 'DRIVER' | 'LISTING';
  targetId: number;
  rating: number;
  comment?: string;
}

class ReviewService {
  async submitReview(payload: CreateReviewPayload): Promise<ReviewItem> {
    const res = await apiClient.post<{ success: boolean; data: ReviewItem }>(
      ApiEndpoints.common.reviews,
      payload
    );
    return res.data;
  }

  async getReviews(targetType: 'RESTAURANT' | 'DRIVER' | 'LISTING', targetId: number): Promise<ReviewItem[]> {
    const res = await apiClient.get<{ success: boolean; data: ReviewItem[] }>(
      `${ApiEndpoints.common.reviews}?targetType=${targetType}&targetId=${targetId}`
    );
    return res.data || [];
  }
}

export const reviewService = new ReviewService();
