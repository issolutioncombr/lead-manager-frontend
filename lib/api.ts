import axios from 'axios';

import { clearStoredAuth, getStoredAuth } from './auth-storage';

const rawBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const trimmed = (rawBase || '').replace(/\/+$/, '');
const baseURL = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;

const api = axios.create({
  baseURL
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = getStoredAuth();

    if (stored?.token) {
      config.headers.Authorization = `Bearer ${stored.token}`;
    }

    if (stored?.user?.apiKey) {
      config.headers['x-tenant-key'] = stored.user.apiKey;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      clearStoredAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export type SellerActiveVideoCallLinkResponse = {
  active: boolean;
  link: null | {
    sellerId: string;
    leadId: string;
    appointmentId: string | null;
    lead?: { id: string; contact?: string | null; name?: string | null; email?: string | null };
  };
};

export const getActiveSellerLink = async () => {
  const { data } = await api.get<SellerActiveVideoCallLinkResponse>('/sellers/me/video-call-link/active');
  return data;
};

export const linkSellerToVideoCall = async (sellerId: string, appointmentId: string) => {
  const { data } = await api.post(`/sellers/${sellerId}/video-call-links`, { appointmentId });
  return data;
};

export const unlinkSellerLink = async (sellerId: string, linkId: string) => {
  const { data } = await api.delete(`/sellers/${sellerId}/video-call-links/${linkId}`);
  return data;
};
