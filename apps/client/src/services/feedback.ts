import { storage } from '../shared/config/storage';
import { apiClient } from './api';

export type FeedbackCategory = 'bug' | 'idea' | 'other';

export interface FeedbackPayload {
  category: FeedbackCategory;
  message: string;
  screenshot?: string;
}

interface FeedbackRequest extends FeedbackPayload {
  userId?: string;
  userDisplayName?: string;
}

export const sendFeedback = async (payload: FeedbackPayload) => {
  const user = storage.get('cloverUser');

  const requestBody: FeedbackRequest = {
    ...payload,
    userId: user?.id,
    userDisplayName: user?.displayName ?? user?.username,
  };

  return apiClient.post('/feedback', requestBody);
};
