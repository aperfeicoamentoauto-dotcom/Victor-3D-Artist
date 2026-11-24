import {
  ArrowRight,
  Box,
  Download,
  Globe,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccountView } from './components/AccountView';
import { AdminView } from './components/AdminView';
import { CartDrawer } from './components/CartDrawer';
import { Header, type AppRoute } from './components/Header';
import { PoliciesView } from './components/PoliciesView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailView } from './components/ProductDetailView';
import { api, formatUsd, MASCOT_IMAGE_URL } from './lib/api';
import type { Category, PlatformCategory, Product, ShopifyStatus, UserProfile } from './types';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<AppRoute>('home');
  const [selectedSlug, setSelectedSlug] = useState<string>('');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [needsAdminClaim, setNeedsAdminClaim] = useState(false);
  const [adminPasscodeConfigured, setAdminPasscodeConfigured] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null);

  const [cart, setCart] = useState<Product[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'All' | PlatformCategory>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pack' | 'individual'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'under5' | '5to10' | '10to25'>('all');
  const [sortBy, setSortBy] = useState<'bestselling' | 'newest' | 'price_asc' | 'price_desc'>('bestselling');

  const refreshStore = async () => {
    const [cats, prods, shopify] = await Promise.all([
      api.getCategories(),
      api.getProducts(),
      api.getShopifyStatus(),
    ]);
    setCategories(cats);
    setProducts(prods);
    setShopifyStatus(shopify);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([api.me(), refreshStore()])
      .then(([authState]) => {
        if (!mounted) return;
        setUser(authState.user);
        setNeedsAdminClaim(authState.needsAdminClaim);
        setAdminPasscodeConfigured(authState.adminPasscodeConfigured);
      })
      .finally(() => {
        if (mounted) {
          setTimeout(() => setBooting(false), 350);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleNavigate = (nextRoute: AppRoute, param?: string) => {
    setRoute(nextRoute);
    if (nextRoute === 'product' && param) {
      setSelectedSlug(param);
    }
    if (nextRoute === 'packs') {
      setTypeFilter('pack');
      setPlatformFilter('All');
      setCategoryFilter('all');
    } else if (nextRoute === 'catalog' && param) {
      setCategoryFilter(param);
      setTypeFilter('all');
    } else if (nextRoute === 'catalog' && !param) {
      setTypeFilter('all');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
    setCartOpen(true);
  };

  const handleBuyNow = (product: Product) => {
    setCart((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]));
    setCartOpen(true);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    const authState = await api.me().catch(() => null);
    if (authState) {
      setNeedsAdminClaim(authState.needsAdminClaim);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        if (q && !p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return false;
        }
        if (platformFilter !== 'All' && p.platform !== platformFilter) return false;
        if (categoryFilter !== 'all' && p.categorySlug !== categoryFilter) return false;
        if (typeFilter === 'pack' && !p.isPack) return false;
        if (typeFilter === 'individual' && p.isPack) return false;
        if (priceFilter === 'free' && p.priceUsd !== 0) return false;
        if (priceFilter === 'under5' && (p.priceUsd === 0 || p.priceUsd > 5)) return false;
        if (priceFilter === '5to10' && (p.priceUsd < 5 || p.priceUsd > 10)) return false;
        if (priceFilter === '10to25' && (p.priceUsd < 10 || p.priceUsd > 25)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.priceUsd - b.priceUsd;
        if (sortBy === 'price_desc') return b.priceUsd - a.priceUsd;
        if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        return b.salesCount - a.salesCount;
      });
  }, [products, searchQuery, platformFilter, categoryFilter, typeFilter, priceFilter, sortBy]);

  const activeProduct = useMemo(
    () => products.find((p) => p.slug === selectedSlug || p.id === selectedSlug) || null,
    [products, selectedSlug]
  );

  const featuredPacks = useMemo(
    () => products.filter((p) => p.isPack && (p.isFeatured || p.isBestseller)).slice(0, 6),
    [products]
  );

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFC] px-4 text-center">
        <img
          src={MASCOT_IMAGE_URL}
          alt="Senhor Raposa Mascot"
          referrerPolicy="no-referrer"
          className="h-24 w-24 rounded-2xl object-cover border-2 border-[#B9A0E8] shadow-md"
        />
        <p className="mt-4 font-display text-xl font-extrabold text-[#161320]">
          Fox Boy's 3D Assets
        </p>
        <p className="mt-1 text-sm text-[#5C576B]">
          Preparing studio 3D models and packs...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#161320]">
      <Header
        currentRoute={route}
        cartCount={cart.length}
        onNavigate={handleNavigate}
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="flex-1">
        {route === 'home' && (
          <>
            {/* Storefront Hero with Senhor Raposa Mascot */}
            <section className="border-b border-[#E6E2F0] bg-[#FAFAFC]">
              <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-16">
                <div className="lg:col-span-7 space-y-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#6D4BB3]">
                    International 3D Asset Store · Prices in USD
                  </p>
                  <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[#161320] sm:text-5xl text-balance">
                    HIGH-QUALITY 3D ASSETS AT AFFORDABLE PRICES.
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-[#5C576B] sm:text-lg">
                    Discover affordable 3D assets and ready-to-use packs for Roblox Studio, UGC creators and game developers around the world.
                  </p>

                  {/* Search + Primary CTA */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-md">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C576B]" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleNavigate('catalog');
                        }}
                        placeholder="Search cars, houses, UGC hats, city packs..."
                        className="w-full rounded-lg border border-[#E6E2F0] bg-white py-3 pl-10 pr-4 text-sm text-[#161320] focus:border-[#6D4BB3] focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('catalog')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#B9A0E8] px-6 py-3 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Explore Assets</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Mascot Focal Card */}
                <div className="lg:col-span-5">
                  <div className="overflow-hidden rounded-2xl border border-[#E6E2F0] bg-[#EFEAF9] p-6">
                    <div className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-5">
                      <img
                        src={MASCOT_IMAGE_URL}
                        alt="Senhor Raposa — Official Mascot of Fox Boy's 3D Assets"
                        referrerPolicy="no-referrer"
                        className="h-36 w-36 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[#6D4BB3]">
                          Meet Senhor Raposa
                        </p>
                        <h2 className="mt-1 font-display text-xl font-extrabold text-[#161320]">
                          Built for Indie Creators
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-[#5C576B]">
                          Clean topology, ready-to-import Roblox Studio &amp; Blender packs from $2 to $25 USD — without studio-sized budgets.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-column Value Strip */}
              <div className="border-t border-[#E6E2F0] bg-white">
                <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-[#6D4BB3] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">Indie USD Pricing</p>
                      <p className="text-xs text-[#5C576B]">Single models $2–$5 · Packs $5–$25</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Layers className="h-5 w-5 text-[#6D4BB3] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">6 Studio Formats</p>
                      <p className="text-xs text-[#5C576B]">.BLEND, .FBX, .OBJ, .RBXM, .RBXMX, .ZIP</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-[#6D4BB3] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">Instant Delivery</p>
                      <p className="text-xs text-[#5C576B]">Automatic library unlock on purchase</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-[#6D4BB3] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display text-sm font-bold text-[#161320]">Commercial License</p>
                      <p className="text-xs text-[#5C576B]">Ready for monetized Roblox &amp; indie games</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Popular 3D Packs & Best Sellers */}
            <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#6D4BB3]">
                    Best Sellers &amp; Multi-Model Bundles
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-extrabold text-[#161320]">
                    Popular 3D Packs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate('packs')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#161320] hover:text-[#6D4BB3]"
                >
                  <span>View All Packs</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredPacks.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    inCart={cart.some((c) => c.id === product.id)}
                    onView={(slug) => handleNavigate('product', slug)}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </section>

            {/* 3 Core Platforms Showcase */}
            <section className="border-t border-[#E6E2F0] bg-[#FAFAFC]">
              <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
                <div className="max-w-2xl">
                  <h2 className="font-display text-3xl font-extrabold text-[#161320]">
                    Organized by Workflow
                  </h2>
                  <p className="mt-2 text-sm text-[#5C576B]">
                    Jump straight to assets sized, rigged, and formatted for your target engine.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                  {(
                    [
                      {
                        platform: 'Roblox Studio',
                        desc: 'Low-poly vehicles, houses, city blocks, furniture, pets, and modular worlds.',
                      },
                      {
                        platform: 'Roblox UGC',
                        desc: 'Hats, hair, glasses, backpacks, and wearable accessories sized to UGC triangle limits.',
                      },
                      {
                        platform: 'Game Development',
                        desc: 'Clean FBX, OBJ, and BLEND kits ready for Unity, Unreal Engine, and Godot.',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.platform}
                      type="button"
                      onClick={() => {
                        setPlatformFilter(item.platform);
                        setCategoryFilter('all');
                        handleNavigate('catalog');
                      }}
                      className="flex flex-col justify-between rounded-xl border border-[#E6E2F0] bg-white p-6 text-left hover:border-[#B9A0E8] transition-colors"
                    >
                      <div>
                        <Box className="h-6 w-6 text-[#6D4BB3]" />
                        <h3 className="mt-4 font-display text-xl font-bold text-[#161320]">
                          {item.platform}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#5C576B]">{item.desc}</p>
                      </div>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#6D4BB3]">
                        <span>Browse {item.platform}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {(route === 'catalog' || route === 'packs') && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b border-[#E6E2F0] pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#161320]">
                  {route === 'packs' ? '3D Asset Packs & Collections' : 'Complete 3D Asset Catalog'}
                </h1>
                <p className="mt-1 text-sm text-[#5C576B]">
                  Showing <span className="font-mono font-semibold text-[#161320] tabular-nums">{filteredProducts.length}</span> ready-to-use assets priced in USD.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C576B]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models or packs..."
                  className="w-full rounded-lg border border-[#E6E2F0] py-2.5 pl-9 pr-3 text-sm focus:border-[#6D4BB3] focus:outline-none"
                />
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Platform Tabs */}
              <div className="flex flex-wrap gap-1 rounded-lg bg-[#F4F2F9] p-1">
                {(['All', 'Roblox Studio', 'Roblox UGC', 'Game Development'] as const).map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => {
                      setPlatformFilter(plat);
                      setCategoryFilter('all');
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      platformFilter === plat
                        ? 'bg-white text-[#161320] shadow-sm'
                        : 'text-[#5C576B] hover:text-[#161320]'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-xs font-semibold text-[#161320]"
              >
                <option value="all">All Categories</option>
                {categories
                  .filter((c) => platformFilter === 'All' || c.platform === platformFilter)
                  .map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                aria-label="Filter by asset type"
                className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-xs font-semibold text-[#161320]"
              >
                <option value="all">All Asset Types</option>
                <option value="pack">3D Packs Only</option>
                <option value="individual">Individual Models Only</option>
              </select>

              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
                aria-label="Filter by USD price"
                className="rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-xs font-semibold text-[#161320]"
              >
                <option value="all">Any USD Price</option>
                <option value="free">Free Sample ($0)</option>
                <option value="under5">Under $5 USD</option>
                <option value="5to10">$5 – $10 USD</option>
                <option value="10to25">$10 – $25 USD</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Sort products"
                className="ml-auto rounded-lg border border-[#E6E2F0] bg-white px-3 py-2 text-xs font-semibold text-[#161320]"
              >
                <option value="bestselling">Sort: Best Selling</option>
                <option value="newest">Sort: New Releases</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="mt-10 rounded-xl border border-[#E6E2F0] bg-[#FAFAFC] p-10 text-center">
                <p className="font-display text-lg font-bold text-[#161320]">
                  No assets matched those filters
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPlatformFilter('All');
                    setCategoryFilter('all');
                    setTypeFilter('all');
                    setPriceFilter('all');
                  }}
                  className="mt-4 rounded-lg bg-[#B9A0E8] px-4 py-2 text-xs font-bold text-[#161320]"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    inCart={cart.some((c) => c.id === product.id)}
                    onView={(slug) => handleNavigate('product', slug)}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {route === 'categories' && (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="font-display text-3xl font-extrabold text-[#161320]">
              Browse All Categories
            </h1>
            <p className="mt-2 text-sm text-[#5C576B]">
              Select any category across Roblox Studio, Roblox UGC, and Game Development to view matching models and packs.
            </p>

            <div className="mt-8 space-y-10">
              {(['Roblox Studio', 'Roblox UGC', 'Game Development'] as PlatformCategory[]).map(
                (platform) => (
                  <div key={platform}>
                    <h2 className="font-display text-xl font-bold text-[#161320] border-b border-[#E6E2F0] pb-2">
                      {platform}
                    </h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categories
                        .filter((c) => c.platform === platform)
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setPlatformFilter(platform);
                              handleNavigate('catalog', cat.slug);
                            }}
                            className="flex flex-col justify-between rounded-xl border border-[#E6E2F0] bg-white p-5 text-left hover:border-[#B9A0E8] transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <h3 className="font-display text-base font-bold text-[#161320]">
                                  {cat.name}
                                </h3>
                                <span className="font-mono text-xs text-[#6D4BB3] tabular-nums">
                                  {cat.productCount || 0} items
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-[#5C576B]">
                                {cat.description}
                              </p>
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {route === 'product' && activeProduct && (
          <ProductDetailView
            product={activeProduct}
            inCart={cart.some((c) => c.id === activeProduct.id)}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onBack={() => handleNavigate('catalog')}
            onNavigate={handleNavigate}
          />
        )}

        {route === 'account' && (
          <AccountView
            user={user}
            onAuthSuccess={(u) => setUser(u)}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        )}

        {route === 'admin' && (
          <AdminView
            user={user}
            needsAdminClaim={needsAdminClaim}
            adminPasscodeConfigured={adminPasscodeConfigured}
            shopifyStatus={shopifyStatus}
            categories={categories}
            products={products}
            onAuthSuccess={(u) => {
              setUser(u);
              setNeedsAdminClaim(false);
            }}
            onRefreshStore={refreshStore}
          />
        )}

        {route === 'policies' && <PoliciesView onBack={() => handleNavigate('home')} />}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-[#E6E2F0] bg-[#FAFAFC]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src={MASCOT_IMAGE_URL}
              alt="Senhor Raposa"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg object-cover border border-[#E6E2F0]"
            />
            <div>
              <p className="font-display text-sm font-bold text-[#161320]">Fox Boy's 3D Assets</p>
              <p className="text-xs text-[#5C576B] flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                <span>Worldwide Digital Delivery · All prices in USD</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#5C576B]">
            <button type="button" onClick={() => handleNavigate('catalog')} className="hover:text-[#161320]">
              Catalog
            </button>
            <button type="button" onClick={() => handleNavigate('packs')} className="hover:text-[#161320]">
              3D Packs
            </button>
            <button type="button" onClick={() => handleNavigate('account')} className="hover:text-[#161320]">
              My Library
            </button>
            <button type="button" onClick={() => handleNavigate('policies')} className="hover:text-[#161320]">
              Licensing &amp; Privacy
            </button>
            <span className="text-[#8D879E]">© {new Date().getFullYear()} Fox Boy's 3D Assets</span>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        items={cart}
        user={user}
        shopifyStatus={shopifyStatus}
        onClose={() => setCartOpen(false)}
        onRemoveItem={(id) => setCart((prev) => prev.filter((p) => p.id !== id))}
        onClearCart={() => setCart([])}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
