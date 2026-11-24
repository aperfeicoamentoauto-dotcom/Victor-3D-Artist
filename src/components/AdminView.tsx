import {
  CheckCircle2,
  FolderPlus,
  Package,
  RefreshCw,
  Shield,
  ShoppingCart,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, formatBytes, formatUsd, setInMemoryAuthToken } from '../lib/api';
import type {
  AdminStats,
  AssetFormat,
  Category,
  Coupon,
  Order,
  PlatformCategory,
  Product,
  ShopifyStatus,
  SupportTicket,
  ThreePreset,
  UserProfile,
} from '../types';

interface AdminViewProps {
  user: UserProfile | null;
  needsAdminClaim: boolean;
  adminPasscodeConfigured: boolean;
  shopifyStatus: ShopifyStatus | null;
  categories: Category[];
  products: Product[];
  onAuthSuccess: (user: UserProfile) => void;
  onRefreshStore: () => Promise<void>;
}

const IMAGE_PRESETS = [
  { label: 'Sports Cars Render', value: '/src/assets/images/pack_sports_cars_1795533988684.jpg' },
  { label: 'Low Poly Houses Render', value: '/src/assets/images/pack_lowpoly_houses_1795533989145.jpg' },
  { label: 'Roblox City Render', value: '/src/assets/images/pack_roblox_city_1795533990083.jpg' },
  { label: 'UGC Accessories Render', value: '/src/assets/images/pack_ugc_accessories_1795533990409.jpg' },
  { label: 'Furniture Pack Render', value: '/src/assets/images/pack_furniture_starter_1795533991411.jpg' },
];

const ALL_FORMATS: AssetFormat[] = ['.BLEND', '.FBX', '.OBJ', '.RBXM', '.RBXMX', '.ZIP'];

export function AdminView({
  user,
  needsAdminClaim,
  adminPasscodeConfigured,
  shopifyStatus,
  categories,
  products,
  onAuthSuccess,
  onRefreshStore,
}: AdminViewProps) {
  const [claimEmail, setClaimEmail] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [tab, setTab] = useState<'overview' | 'products' | 'categories' | 'coupons' | 'orders' | 'shopify'>(
    'overview'
  );
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Product Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('12');
  const [pCompare, setPCompare] = useState('');
  const [pIsPack, setPIsPack] = useState(true);
  const [pModelCount, setPModelCount] = useState('5');
  const [pPolyCount, setPPolyCount] = useState('10,000 tris');
  const [pPlatform, setPPlatform] = useState<PlatformCategory>('Roblox Studio');
  const [pCatSlug, setPCatSlug] = useState('cars-vehicles');
  const [pFormats, setPFormats] = useState<AssetFormat[]>(['.FBX', '.OBJ', '.RBXMX', '.ZIP']);
  const [pCompat, setPCompat] = useState('Roblox Studio, Blender 4.x, Unity');
  const [pImageUrl, setPImageUrl] = useState(IMAGE_PRESETS[0].value);
  const [pVideoUrl, setPVideoUrl] = useState('');
  const [pPreset, setPPreset] = useState<ThreePreset>('sports_car');
  const [pLicenseNotes, setPLicenseNotes] = useState('Commercial & in-game use allowed. No raw file resale.');
  const [pFeatured, setPFeatured] = useState(true);
  const [pBestseller, setPBestseller] = useState(false);

  // File Upload State
  const [uploadProductId, setUploadProductId] = useState<string>('');
  const [uploadFormat, setUploadFormat] = useState<AssetFormat>('.RBXMX');
  const [uploadVersion, setUploadVersion] = useState('1.1');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Category Form
  const [catName, setCatName] = useState('');
  const [catPlatform, setCatPlatform] = useState<PlatformCategory>('Roblox Studio');
  const [catDesc, setCatDesc] = useState('');

  // Coupon Form
  const [cCode, setCCode] = useState('');
  const [cDiscount, setCDiscount] = useState('15');
  const [cMaxUses, setCMaxUses] = useState('100');

  const isAdmin = user?.role === 'admin';

  const loadAdminData = async () => {
    if (!isAdmin) return;
    try {
      const [s, c, o, t] = await Promise.all([
        api.getAdminStats(),
        api.getCoupons(),
        api.getAdminOrders(),
        api.getAdminTickets(),
      ]);
      setStats(s);
      setCoupons(c);
      setOrders(o);
      setTickets(t);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to fetch admin telemetry.');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (products.length > 0 && !uploadProductId) {
      setUploadProductId(products[0].id);
    }
  }, [products, uploadProductId]);

  const handleClaimAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);
    try {
      const res = await api.claimAdmin({ email: claimEmail, name: claimName, password: claimPassword });
      setInMemoryAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to claim owner account.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmittingAuth(true);
    try {
      const res = await api.adminLogin(
        adminPasscodeConfigured && passcode
          ? { passcode }
          : { email: loginEmail, password: loginPassword }
      );
      setInMemoryAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Owner login failed.');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setPTitle('');
    setPDesc('');
    setPPrice('10');
    setPCompare('');
    setPIsPack(true);
    setPModelCount('5');
    setPPolyCount('8,500 tris');
    setPPlatform('Roblox Studio');
    setPCatSlug(categories[0]?.slug || 'cars-vehicles');
    setPFormats(['.FBX', '.OBJ', '.RBXMX', '.ZIP']);
    setPCompat('Roblox Studio, Blender 4.x');
    setPImageUrl(IMAGE_PRESETS[0].value);
    setPVideoUrl('');
    setPPreset('sports_car');
    setPLicenseNotes('Commercial & in-game use allowed. No raw file resale.');
    setPFeatured(false);
    setPBestseller(false);
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id);
    setPTitle(p.title);
    setPDesc(p.description);
    setPPrice(String(p.priceUsd));
    setPCompare(p.compareAtUsd !== null ? String(p.compareAtUsd) : '');
    setPIsPack(p.isPack);
    setPModelCount(String(p.modelCount));
    setPPolyCount(p.polyCount);
    setPPlatform(p.platform);
    setPCatSlug(p.categorySlug);
    setPFormats(p.formats);
    setPCompat(p.compatibility.join(', '));
    setPImageUrl(p.imageUrl);
    setPVideoUrl(p.videoUrl || '');
    setPPreset(p.threePreset);
    setPLicenseNotes(p.license.specialNotes);
    setPFeatured(p.isFeatured);
    setPBestseller(p.isBestseller);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const payload = {
      title: pTitle,
      description: pDesc,
      priceUsd: Number(pPrice),
      compareAtUsd: pCompare ? Number(pCompare) : null,
      isPack: pIsPack,
      modelCount: Number(pModelCount),
      polyCount: pPolyCount,
      platform: pPlatform,
      categorySlug: pCatSlug,
      formats: pFormats,
      compatibility: pCompat
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      texturesIncluded: true,
      licenseType: 'Standard Commercial & Game License',
      license: {
        personalUse: true,
        commercialUse: true,
        inGameUse: true,
        noRedistribution: true,
        noResaleOriginal: true,
        specialNotes: pLicenseNotes,
      },
      imageUrl: pImageUrl,
      videoUrl: pVideoUrl || null,
      threePreset: pPreset,
      isFeatured: pFeatured,
      isBestseller: pBestseller,
    };

    try {
      if (editingId) {
        await api.updateProduct(editingId, payload);
        setNotice('Product updated.');
      } else {
        await api.createProduct(payload);
        setNotice('New product/pack published with downloadable 3D bundle.');
      }
      resetProductForm();
      await onRefreshStore();
      await loadAdminData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save product.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      setNotice('Product deleted.');
      await onRefreshStore();
      await loadAdminData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to delete product.');
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadProductId) return;
    setUploadingFile(true);
    setNotice(null);

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const contentBase64 = btoa(binary);
      await api.uploadProductFile(uploadProductId, {
        fileName: file.name,
        format: uploadFormat,
        version: uploadVersion,
        contentBase64,
      });
      setNotice(`Uploaded ${file.name} (v${uploadVersion}) and unlocked for existing buyers.`);
      await onRefreshStore();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createCategory({ name: catName, platform: catPlatform, description: catDesc });
      setCatName('');
      setCatDesc('');
      setNotice('Category created.');
      await onRefreshStore();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to create category.');
    }
  };

  const handleCreateCoupon = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createCoupon({
        code: cCode,
        discountPercent: Number(cDiscount),
        maxUses: cMaxUses ? Number(cMaxUses) : null,
      });
      setCCode('');
      setNotice('Coupon created.');
      await loadAdminData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to create coupon.');
    }
  };

  const handleSyncShopify = async () => {
    setNotice(null);
    try {
      const res = await api.syncShopifyCatalog();
      setNotice(`Synced ${res.syncedCount} products & variants with Shopify Admin API.`);
      await onRefreshStore();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Shopify sync failed.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-2xl border border-[#E6E2F0] bg-white p-7 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-[#6D4BB3]" />
            <h1 className="font-display text-xl font-extrabold text-[#161320]">
              {needsAdminClaim ? 'First-Run Owner Setup' : 'Store Owner Sign In'}
            </h1>
          </div>

          {needsAdminClaim ? (
            <form onSubmit={handleClaimAdmin} className="mt-5 space-y-4">
              <p className="text-xs leading-relaxed text-[#5C576B]">
                No owner account is configured yet. Create the store owner account below to unlock the Admin Panel. This setup locks automatically once claimed.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Owner Name</label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="Fox Boy Owner"
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Owner Email</label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="owner@foxboys3d.com"
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Password (8+ chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                />
              </div>
              {authError && <p className="text-xs text-red-600">{authError}</p>}
              <button
                type="submit"
                disabled={submittingAuth}
                className="w-full rounded-lg bg-[#B9A0E8] px-4 py-2.5 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3]"
              >
                {submittingAuth ? 'Claiming...' : 'Claim Owner Admin Panel'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="mt-5 space-y-4">
              <p className="text-xs text-[#5C576B]">
                Sign in with your owner credentials to manage products, 3D packs, pricing, orders, and Shopify sync.
              </p>
              {adminPasscodeConfigured ? (
                <div>
                  <label className="block text-xs font-semibold text-[#161320]">Owner Admin Passcode</label>
                  <input
                    type="password"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#161320]">Owner Email</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#161320]">Password</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </>
              )}
              {authError && <p className="text-xs text-red-600">{authError}</p>}
              <button
                type="submit"
                disabled={submittingAuth}
                className="w-full rounded-lg bg-[#161320] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2E2842]"
              >
                {submittingAuth ? 'Signing In...' : 'Enter Admin Panel'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#161320]">
            Fox Boy's 3D Assets — Owner Admin Panel
          </h1>
          <p className="text-sm text-[#5C576B]">
            Manage USD catalog, 3D packs, digital files, discount coupons, orders, and Shopify sync without code.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[#E6E2F0] pb-3">
        {[
          { id: 'overview', label: 'Overview & Stats', icon: Package },
          { id: 'products', label: 'Products & 3D Packs', icon: Upload },
          { id: 'categories', label: 'Categories', icon: FolderPlus },
          { id: 'coupons', label: 'Coupons', icon: Tag },
          { id: 'orders', label: 'Orders & Support', icon: ShoppingCart },
          { id: 'shopify', label: 'Shopify Integration', icon: RefreshCw },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                active ? 'bg-[#161320] text-white' : 'text-[#5C576B] hover:bg-[#EFEAF9] hover:text-[#161320]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#B9A0E8] bg-[#EFEAF9] px-4 py-3 text-sm font-medium text-[#161320]">
          <CheckCircle2 className="h-4 w-4 text-[#6D4BB3]" />
          <span>{notice}</span>
        </div>
      )}

      {tab === 'overview' && stats && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Total Revenue (USD)', value: formatUsd(stats.totalRevenueUsd) },
              { label: 'Paid Orders', value: String(stats.paidOrdersCount) },
              { label: 'Catalog Items / Packs', value: `${stats.totalProducts} (${stats.totalPacks} packs)` },
              { label: 'Protected Downloads', value: String(stats.totalDownloads) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-[#E6E2F0] bg-white p-5">
                <p className="text-xs font-medium text-[#5C576B]">{kpi.label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold text-[#161320] tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#E6E2F0] bg-white p-6">
            <h2 className="font-display text-base font-bold text-[#161320]">Top Selling Assets</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E6E2F0] text-xs text-[#5C576B]">
                    <th className="py-2 font-semibold">Asset Title</th>
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">USD Price</th>
                    <th className="py-2 font-semibold text-right">Sales / Claims</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECF8]">
                  {stats.topProducts.map((tp) => (
                    <tr key={tp.id}>
                      <td className="py-3 font-medium text-[#161320]">{tp.title}</td>
                      <td className="py-3 text-[#5C576B]">{tp.isPack ? '3D Pack' : 'Single Asset'}</td>
                      <td className="py-3 font-mono tabular-nums">{formatUsd(tp.priceUsd)}</td>
                      <td className="py-3 text-right font-mono tabular-nums">{tp.salesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Create / Edit Product Form */}
          <form
            onSubmit={handleSaveProduct}
            className="lg:col-span-5 rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#161320]">
                {editingId ? 'Edit Asset / Pack' : 'Create Product or 3D Pack'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetProductForm}
                  className="text-xs font-semibold text-[#6D4BB3] hover:underline"
                >
                  New Item
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">Product Title</label>
              <input
                type="text"
                required
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Super Car Pack"
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Original Price (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pCompare}
                  onChange={(e) => setPCompare(e.target.value)}
                  placeholder="18.00"
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Platform</label>
                <select
                  value={pPlatform}
                  onChange={(e) => setPPlatform(e.target.value as PlatformCategory)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
                >
                  <option value="Roblox Studio">Roblox Studio</option>
                  <option value="Roblox UGC">Roblox UGC</option>
                  <option value="Game Development">Game Development</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Category</label>
                <select
                  value={pCatSlug}
                  onChange={(e) => setPCatSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} ({c.platform})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Models Count</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={pModelCount}
                  onChange={(e) => setPModelCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Polygon Count</label>
                <input
                  type="text"
                  value={pPolyCount}
                  onChange={(e) => setPPolyCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">Included Formats</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ALL_FORMATS.map((fmt) => {
                  const checked = pFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() =>
                        setPFormats((prev) =>
                          checked ? prev.filter((x) => x !== fmt) : [...prev, fmt]
                        )
                      }
                      className={`rounded-md px-2.5 py-1 text-xs font-mono font-semibold border ${
                        checked
                          ? 'bg-[#EFEAF9] border-[#B9A0E8] text-[#161320]'
                          : 'bg-white border-[#E6E2F0] text-[#5C576B]'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">Description</label>
              <textarea
                required
                rows={3}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#161320]">Thumbnail Image</label>
                <select
                  value={pImageUrl}
                  onChange={(e) => setPImageUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
                >
                  {IMAGE_PRESETS.map((img) => (
                    <option key={img.value} value={img.value}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#161320]">3D Viewport Model</label>
                <select
                  value={pPreset}
                  onChange={(e) => setPPreset(e.target.value as ThreePreset)}
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
                >
                  <option value="sports_car">Sports Car</option>
                  <option value="lowpoly_house">Low Poly House</option>
                  <option value="city_block">City Block</option>
                  <option value="ugc_headphones">UGC Headphones</option>
                  <option value="furniture">Modern Furniture</option>
                  <option value="glasses">Round Glasses</option>
                  <option value="crates">Crate &amp; Barrel</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">Demo Video URL (Optional)</label>
              <input
                type="url"
                value={pVideoUrl}
                onChange={(e) => setPVideoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">Compatibility (Comma-separated)</label>
              <input
                type="text"
                value={pCompat}
                onChange={(e) => setPCompat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161320]">License Summary Notes</label>
              <input
                type="text"
                value={pLicenseNotes}
                onChange={(e) => setPLicenseNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-medium text-[#161320]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pIsPack} onChange={(e) => setPIsPack(e.target.checked)} />
                <span>Multi-Model Pack</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pFeatured} onChange={(e) => setPFeatured(e.target.checked)} />
                <span>Featured</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pBestseller}
                  onChange={(e) => setPBestseller(e.target.checked)}
                />
                <span>Best Seller</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#B9A0E8] px-4 py-2.5 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3]"
            >
              {editingId ? 'Save Changes' : 'Publish Asset'}
            </button>
          </form>

          {/* Right Column: File Uploader & Catalog Table */}
          <div className="lg:col-span-7 space-y-6">
            {/* Upload 3D File Box */}
            <div className="rounded-xl border border-[#E6E2F0] bg-[#FAFAFC] p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#161320]">
                Upload or Update 3D Asset Files (.BLEND, .FBX, .OBJ, .RBXM, .RBXMX, .ZIP)
              </h3>
              <p className="text-xs text-[#5C576B]">
                Uploading a new version automatically makes it available in existing buyers' libraries.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={uploadProductId}
                  onChange={(e) => setUploadProductId(e.target.value)}
                  className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-sm"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <select
                  value={uploadFormat}
                  onChange={(e) => setUploadFormat(e.target.value as AssetFormat)}
                  className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-sm font-mono"
                >
                  {ALL_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={uploadVersion}
                  onChange={(e) => setUploadVersion(e.target.value)}
                  placeholder="Version (e.g. 1.2)"
                  className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-sm"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#161320] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2E2842]">
                <Upload className="h-4 w-4" />
                <span>{uploadingFile ? 'Uploading...' : 'Select 3D File to Upload'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
              </label>
            </div>

            {/* Product List */}
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="rounded-xl border border-[#E6E2F0] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        className="h-14 w-16 rounded-lg object-cover bg-[#F5F2FA]"
                      />
                      <div>
                        <p className="text-xs text-[#5C576B]">
                          {p.platform} · {p.isPack ? `${p.modelCount} Models` : 'Single'} ·{' '}
                          {p.shopifyVariantId ? 'Shopify Synced' : 'Local Only'}
                        </p>
                        <h4 className="font-display text-sm font-bold text-[#161320]">{p.title}</h4>
                        <p className="font-mono text-xs font-semibold text-[#6D4BB3] tabular-nums">
                          {formatUsd(p.priceUsd)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditProduct(p)}
                        className="rounded-lg border border-[#E6E2F0] px-3 py-1.5 text-xs font-semibold text-[#161320] hover:bg-[#EFEAF9]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p.id)}
                        aria-label={`Delete ${p.title}`}
                        className="rounded-lg border border-[#E6E2F0] p-1.5 text-[#5C576B] hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {p.files && p.files.length > 0 && (
                    <div className="mt-3 border-t border-[#F0ECF8] pt-2.5 flex flex-wrap gap-2">
                      {p.files.map((f) => (
                        <div
                          key={f.id}
                          className="inline-flex items-center gap-2 rounded-md border border-[#E6E2F0] bg-[#FAFAFC] px-2.5 py-1 text-xs"
                        >
                          <span className="font-mono text-[#161320]">{f.fileName}</span>
                          <span className="text-[#5C576B]">
                            v{f.version} ({formatBytes(f.fileSizeBytes)})
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteProductFile(f.id);
                              await onRefreshStore();
                            }}
                            className="text-[#5C576B] hover:text-red-600"
                            title="Delete file"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleCreateCategory}
            className="lg:col-span-4 rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4 self-start"
          >
            <h2 className="font-display text-lg font-bold text-[#161320]">Add Category</h2>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Category Name</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Sci-Fi Weapons"
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Platform Section</label>
              <select
                value={catPlatform}
                onChange={(e) => setCatPlatform(e.target.value as PlatformCategory)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              >
                <option value="Roblox Studio">Roblox Studio</option>
                <option value="Roblox UGC">Roblox UGC</option>
                <option value="Game Development">Game Development</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Description</label>
              <textarea
                rows={3}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#B9A0E8] px-4 py-2.5 text-sm font-bold text-[#161320]"
            >
              Create Category
            </button>
          </form>

          <div className="lg:col-span-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-xl border border-[#E6E2F0] bg-white p-4"
              >
                <div>
                  <p className="text-xs font-medium text-[#6D4BB3]">{c.platform}</p>
                  <p className="font-display text-sm font-bold text-[#161320]">{c.name}</p>
                  <p className="mt-1 text-xs text-[#5C576B]">{c.description}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.deleteCategory(c.id);
                    await onRefreshStore();
                  }}
                  className="rounded-lg p-1.5 text-[#5C576B] hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'coupons' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleCreateCoupon}
            className="lg:col-span-4 rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4 self-start"
          >
            <h2 className="font-display text-lg font-bold text-[#161320]">Create Discount Coupon</h2>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Coupon Code</label>
              <input
                type="text"
                required
                value={cCode}
                onChange={(e) => setCCode(e.target.value)}
                placeholder="ROBLOX25"
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Discount (%)</label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={cDiscount}
                onChange={(e) => setCDiscount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Max Uses</label>
              <input
                type="number"
                min="1"
                value={cMaxUses}
                onChange={(e) => setCMaxUses(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#B9A0E8] px-4 py-2.5 text-sm font-bold text-[#161320]"
            >
              Create Coupon
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {coupons.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center justify-between rounded-xl border border-[#E6E2F0] bg-white p-4"
              >
                <div>
                  <p className="font-mono text-base font-bold text-[#161320]">{cp.code}</p>
                  <p className="text-xs text-[#5C576B] tabular-nums">
                    {cp.discountPercent}% off · Used {cp.usesCount}
                    {cp.maxUses ? ` / ${cp.maxUses}` : ''} times
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await api.toggleCoupon(cp.id, !cp.active);
                      await loadAdminData();
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      cp.active ? 'bg-[#EFEAF9] text-[#161320]' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cp.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.deleteCoupon(cp.id);
                      await loadAdminData();
                    }}
                    className="rounded-lg p-1.5 text-[#5C576B] hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-6 space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#161320]">Customer Orders</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[#5C576B]">No orders yet.</p>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="rounded-xl border border-[#E6E2F0] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">
                        {ord.orderNumber} · {ord.customerEmail}
                      </p>
                      <p className="text-xs text-[#5C576B]">
                        {ord.items.map((i) => i.title).join(', ')} ·{' '}
                        <span className="font-mono tabular-nums">{formatUsd(ord.totalUsd)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={ord.status}
                        onChange={async (e) => {
                          await api.updateOrderStatus(
                            ord.id,
                            e.target.value as 'pending' | 'paid' | 'cancelled'
                          );
                          await loadAdminData();
                          setNotice(`Order ${ord.orderNumber} updated.`);
                        }}
                        className="rounded-lg border border-[#E6E2F0] px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid (Unlock Files)</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#161320]">Support Tickets</h2>
            {tickets.length === 0 ? (
              <p className="text-sm text-[#5C576B]">No open support tickets.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-[#E6E2F0] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">
                        {t.subject} ({t.customerEmail})
                      </p>
                      <p className="mt-1 text-xs text-[#5C576B]">{t.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateTicketStatus(t.id, t.status === 'open' ? 'resolved' : 'open');
                        await loadAdminData();
                      }}
                      className="rounded-lg border border-[#E6E2F0] px-3 py-1.5 text-xs font-semibold"
                    >
                      {t.status === 'open' ? 'Mark Resolved' : 'Reopen'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'shopify' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#161320]">
              Shopify E-Commerce Connection
            </h2>
            <p className="text-sm text-[#5C576B]">
              Shopify secrets are strictly stored on the server (<span className="font-mono">.env</span> / Secrets panel) and never exposed to the browser.
            </p>
            <dl className="space-y-2.5 text-sm border-t border-[#E6E2F0] pt-4">
              <div className="flex justify-between">
                <dt className="text-[#5C576B]">Storefront Checkout API</dt>
                <dd className="font-semibold text-[#161320]">
                  {shopifyStatus?.configured ? `Connected (${shopifyStatus.storeDomainMasked})` : 'Not Configured'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5C576B]">Admin Catalog Sync API</dt>
                <dd className="font-semibold text-[#161320]">
                  {shopifyStatus?.adminSyncEnabled ? 'Ready' : 'Missing SHOPIFY_ADMIN_ACCESS_TOKEN'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5C576B]">Orders/Paid Webhook HMAC</dt>
                <dd className="font-semibold text-[#161320]">
                  {shopifyStatus?.webhookConfigured ? 'Verified Secret Configured' : 'Missing SHOPIFY_WEBHOOK_SECRET'}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={!shopifyStatus?.adminSyncEnabled}
              onClick={handleSyncShopify}
              className="inline-flex items-center gap-2 rounded-lg bg-[#B9A0E8] px-5 py-2.5 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Sync All Products &amp; Packs to Shopify</span>
            </button>
          </div>

          <div className="rounded-xl border border-[#E6E2F0] bg-[#FAFAFC] p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-[#161320]">
              Setup Checklist for Live USD Payments
            </h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-[#5C576B]">
              <li>
                In Shopify Admin, create a custom app with Storefront API (<span className="font-mono">unauthenticated_write_checkouts</span>) and Admin API (<span className="font-mono">write_products, read_orders</span>) scopes.
              </li>
              <li>
                Add <span className="font-mono text-[#161320]">SHOPIFY_STORE_DOMAIN</span>,{' '}
                <span className="font-mono text-[#161320]">SHOPIFY_STOREFRONT_ACCESS_TOKEN</span>,{' '}
                <span className="font-mono text-[#161320]">SHOPIFY_ADMIN_ACCESS_TOKEN</span>, and{' '}
                <span className="font-mono text-[#161320]">SHOPIFY_WEBHOOK_SECRET</span> in Secrets.
              </li>
              <li>
                Configure a Shopify webhook for <strong>Order payment</strong> pointing to:{' '}
                <code className="block mt-1 rounded bg-white border border-[#E6E2F0] px-2.5 py-1.5 text-xs font-mono text-[#161320]">
                  {window.location.origin}/api/webhooks/shopify/orders-paid
                </code>
              </li>
              <li>
                Click <strong>Sync All Products &amp; Packs to Shopify</strong> so every product receives its real Shopify Variant ID.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
