export type PlatformCategory = 'Roblox Studio' | 'Roblox UGC' | 'Game Development';

export type AssetFormat = '.BLEND' | '.FBX' | '.OBJ' | '.RBXM' | '.RBXMX' | '.ZIP';

export type ThreePreset =
  | 'sports_car'
  | 'lowpoly_house'
  | 'city_block'
  | 'ugc_headphones'
  | 'furniture'
  | 'glasses'
  | 'crates';

export interface Category {
  id: string;
  slug: string;
  name: string;
  platform: PlatformCategory;
  description: string;
  sortOrder: number;
  productCount?: number;
}

export interface ProductFile {
  id: string;
  productId: string;
  fileName: string;
  format: AssetFormat;
  fileSizeBytes: number;
  version: string;
  uploadedAt: string;
}

export interface LicenseTerms {
  personalUse: boolean;
  commercialUse: boolean;
  inGameUse: boolean;
  noRedistribution: boolean;
  noResaleOriginal: boolean;
  specialNotes: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceUsd: number;
  compareAtUsd: number | null;
  isPack: boolean;
  modelCount: number;
  polyCount: string;
  categorySlug: string;
  categoryName?: string;
  platform: PlatformCategory;
  compatibility: string[];
  formats: AssetFormat[];
  texturesIncluded: boolean;
  licenseType: string;
  license: LicenseTerms;
  imageUrl: string;
  videoUrl: string | null;
  threePreset: ThreePreset;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  salesCount: number;
  isFeatured: boolean;
  isBestseller: boolean;
  isNew: boolean;
  files?: ProductFile[];
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  active: boolean;
  usesCount: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  country: string;
  studioName: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  title: string;
  priceUsd: number;
  isPack: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerEmail: string;
  shopifyOrderId: string | null;
  shopifyCheckoutUrl: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  subtotalUsd: number;
  discountUsd: number;
  totalUsd: number;
  couponCode: string | null;
  paymentProvider: string;
  items: OrderItem[];
  createdAt: string;
}

export interface LibraryDownloadFile {
  fileId: string;
  fileName: string;
  format: AssetFormat;
  fileSizeBytes: number;
  version: string;
  uploadedAt: string;
  downloadToken: string;
  downloadCount: number;
}

export interface LibraryItem {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string;
  platform: PlatformCategory;
  isPack: boolean;
  modelCount: number;
  licenseType: string;
  purchasedAt: string;
  orderNumber: string;
  files: LibraryDownloadFile[];
}

export interface SupportTicket {
  id: string;
  userId: string;
  customerEmail: string;
  orderNumber: string | null;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface ShopifyStatus {
  configured: boolean;
  storeDomainMasked: string | null;
  adminSyncEnabled: boolean;
  webhookConfigured: boolean;
}

export interface AdminStats {
  totalRevenueUsd: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  totalProducts: number;
  totalPacks: number;
  totalCustomers: number;
  totalDownloads: number;
  topProducts: Array<{
    id: string;
    title: string;
    salesCount: number;
    priceUsd: number;
    isPack: boolean;
  }>;
}
