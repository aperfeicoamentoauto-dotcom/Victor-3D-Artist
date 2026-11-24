import type {
  AdminStats,
  Category,
  Coupon,
  LibraryItem,
  Order,
  Product,
  ShopifyStatus,
  SupportTicket,
  UserProfile,
} from '../types';

export const MASCOT_IMAGE_URL =
  '/assets/aistudio/a12f4b9fa631be019aa5567db2fc54f1_tplv-tiktokx-cropcenter_1080_1080_03079f7c.jpeg';

let inMemoryAuthToken: string | null = null;

export function setInMemoryAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
}

export function getInMemoryAuthToken(): string | null {
  return inMemoryAuthToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (inMemoryAuthToken) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (${response.status})`);
    (err as Error & { code?: string }).code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}

export function formatUsd(amount: number): string {
  if (amount === 0) return 'Free ($0.00)';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const api = {
  getShopifyStatus: () => apiRequest<ShopifyStatus>('/api/shopify/status'),
  getCategories: () => apiRequest<Category[]>('/api/categories'),
  getProducts: (params?: {
    search?: string;
    platform?: string;
    category?: string;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.platform && params.platform !== 'All') qs.set('platform', params.platform);
    if (params?.category && params.category !== 'all') qs.set('category', params.category);
    if (params?.type && params.type !== 'all') qs.set('type', params.type);
    if (params?.minPrice !== undefined) qs.set('minPrice', String(params.minPrice));
    if (params?.maxPrice !== undefined) qs.set('maxPrice', String(params.maxPrice));
    if (params?.sort) qs.set('sort', params.sort);
    const q = qs.toString();
    return apiRequest<Product[]>(`/api/products${q ? `?${q}` : ''}`);
  },
  getProductBySlug: (slug: string) => apiRequest<Product>(`/api/products/${encodeURIComponent(slug)}`),
  validateCoupon: (code: string) =>
    apiRequest<{ code: string; discountPercent: number }>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Auth
  me: () =>
    apiRequest<{ user: UserProfile | null; needsAdminClaim: boolean; adminPasscodeConfigured: boolean }>(
      '/api/auth/me'
    ),
  register: (payload: { email: string; password: string; name: string; country: string; studioName?: string }) =>
    apiRequest<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (payload: { email: string; resetCode: string; newPassword: string }) =>
    apiRequest<{ ok: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  claimAdmin: (payload: { email: string; name: string; password: string }) =>
    apiRequest<{ user: UserProfile; token: string }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminLogin: (payload: { passcode?: string; email?: string; password?: string }) =>
    apiRequest<{ user: UserProfile; token: string }>('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProfile: (payload: { name: string; country: string; studioName: string }) =>
    apiRequest<{ user: UserProfile }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: boolean }>('/api/account/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Orders & Downloads
  claimFreeAssets: (productIds: string[]) =>
    apiRequest<{ orderId: string; orderNumber: string; status: string }>('/api/orders/claim-free', {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    }),
  createShopifyCheckout: (payload: { productIds: string[]; couponCode?: string | null }) =>
    apiRequest<{ orderId: string; orderNumber: string; checkoutUrl: string }>('/api/shopify/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getOrders: () => apiRequest<Order[]>('/api/orders'),
  getLibrary: () => apiRequest<LibraryItem[]>('/api/library'),
  downloadAssetFile: async (downloadToken: string, fileName: string) => {
    const headers = new Headers();
    if (inMemoryAuthToken) {
      headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
    }
    const resp = await fetch(`/api/downloads/${encodeURIComponent(downloadToken)}`, {
      headers,
      credentials: 'include',
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Download failed.');
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Support
  getTickets: () => apiRequest<SupportTicket[]>('/api/support/tickets'),
  createTicket: (payload: { subject: string; message: string; orderNumber?: string }) =>
    apiRequest<SupportTicket>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin
  getAdminStats: () => apiRequest<AdminStats>('/api/admin/stats'),
  createProduct: (payload: Record<string, unknown>) =>
    apiRequest<Product>('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Product>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadProductFile: (
    productId: string,
    payload: { fileName: string; format: string; version: string; contentBase64: string }
  ) =>
    apiRequest(`/api/admin/products/${encodeURIComponent(productId)}/files`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteProductFile: (fileId: string) =>
    apiRequest<{ ok: boolean }>(`/api/admin/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
  createCategory: (payload: { name: string; platform: string; description: string }) =>
    apiRequest<Category>('/api/admin/categories', { method: 'POST', body: JSON.stringify(payload) }),
  deleteCategory: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getCoupons: () => apiRequest<Coupon[]>('/api/admin/coupons'),
  createCoupon: (payload: { code: string; discountPercent: number; maxUses?: number | null }) =>
    apiRequest<Coupon>('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) }),
  toggleCoupon: (id: string, active: boolean) =>
    apiRequest<{ ok: boolean }>(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),
  deleteCoupon: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/admin/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getAdminOrders: () => apiRequest<Order[]>('/api/admin/orders'),
  updateOrderStatus: (id: string, status: 'pending' | 'paid' | 'cancelled') =>
    apiRequest<{ ok: boolean; status: string }>(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getAdminTickets: () => apiRequest<SupportTicket[]>('/api/admin/tickets'),
  updateTicketStatus: (id: string, status: 'open' | 'resolved') =>
    apiRequest<{ ok: boolean }>(`/api/admin/tickets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  syncShopifyCatalog: () =>
    apiRequest<{ syncedCount: number }>('/api/admin/shopify/sync', { method: 'POST' }),
};
