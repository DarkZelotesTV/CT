import { apiClient } from './api';

export interface LivekitCredentials {
  identity: string;
  room: string;
}

export interface LivekitTokenResponse {
  token: string;
  url: string;
}

export const requestLivekitToken = async (
  payload: LivekitCredentials,
  abortSignal?: AbortSignal,
): Promise<LivekitTokenResponse> => {
  const options = abortSignal ? { signal: abortSignal } : undefined;
  return apiClient.post<LivekitTokenResponse>('/api/livekit/token', payload, options);
};
