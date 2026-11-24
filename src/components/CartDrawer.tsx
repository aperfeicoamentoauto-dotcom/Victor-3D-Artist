import { AlertCircle, ArrowRight, ExternalLink, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { api, formatUsd } from '../lib/api';
import type { Product, ShopifyStatus, UserProfile } from '../types';
import type { AppRoute } from './Header';

interface CartDrawerProps {
  open: boolean;
  items: Product[];
  user: UserProfile | null;
  shopifyStatus: ShopifyStatus | null;
  onClose: () => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function CartDrawer({
  open,
  items,
  user,
  shopifyStatus,
  onClose,
  onRemoveItem,
  onClearCart,
  onNavigate,
}: CartDrawerProps) {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shopifyUrlResult, setShopifyUrlResult] = useState<{ orderNumber: string; checkoutUrl: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const subtotal = items.reduce((sum, p) => sum + p.priceUsd, 0);
  const discount = appliedCoupon ? Number(((subtotal * appliedCoupon.discountPercent) / 100).toFixed(2)) : 0;
  const total = Math.max(0, Number((subtotal - discount).toFixed(2)));

  const handleApplyCoupon = async () => {
    setCouponError(null);
    if (!couponInput.trim()) return;
    try {
      const res = await api.validateCoupon(couponInput.trim());
      setAppliedCoupon(res);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof Error ? err.message : 'Invalid coupon code.');
    }
  };

  const handleCheckout = async () => {
    setCheckoutError(null);
    setShopifyUrlResult(null);

    if (!user) {
      onClose();
      onNavigate('account');
      return;
    }

    if (items.length === 0) return;
    setSubmitting(true);

    try {
      if (total === 0 && items.every((i) => i.priceUsd === 0)) {
        await api.claimFreeAssets(items.map((i) => i.id));
        onClearCart();
        onClose();
        onNavigate('account');
        return;
      }

      const res = await api.createShopifyCheckout({
        productIds: items.map((i) => i.id),
        couponCode: appliedCoupon?.code || null,
      });
      setShopifyUrlResult({ orderNumber: res.orderNumber, checkoutUrl: res.checkoutUrl });
      onClearCart();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to start checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#161320]/45">
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-[#E6E2F0]"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
      >
        <div className="flex items-center justify-between border-b border-[#E6E2F0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#6D4BB3]" />
            <h2 className="font-display text-lg font-bold text-[#161320]">
              Your Cart ({items.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="rounded-lg p-2 text-[#5C576B] hover:bg-[#EFEAF9] hover:text-[#161320] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {shopifyUrlResult ? (
            <div className="rounded-xl border border-[#B9A0E8] bg-[#EFEAF9]/60 p-5">
              <p className="font-display text-base font-bold text-[#161320]">
                Shopify Checkout Ready — Order {shopifyUrlResult.orderNumber}
              </p>
              <p className="mt-2 text-sm text-[#5C576B]">
                Complete your USD payment securely on Shopify. Once confirmed, your 3D files automatically unlock in your Account Library.
              </p>
              <a
                href={shopifyUrlResult.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#161320] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2E2842] transition-colors"
              >
                <span>Proceed to Shopify Checkout</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-[#B9A0E8]" />
              <p className="mt-3 font-display text-base font-semibold text-[#161320]">
                Your cart is empty
              </p>
              <p className="mt-1 text-sm text-[#5C576B]">
                Explore ready-to-use 3D models and packs starting at $2.00 USD.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate('catalog');
                }}
                className="mt-5 rounded-lg bg-[#B9A0E8] px-5 py-2.5 text-sm font-semibold text-[#161320] hover:bg-[#ab8ee3] transition-colors"
              >
                Explore Assets
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 rounded-xl border border-[#E6E2F0] p-3.5"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-16 w-20 rounded-lg object-cover bg-[#F5F2FA] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#5C576B]">
                      {item.platform} · {item.isPack ? `${item.modelCount} Models` : 'Single Model'}
                    </p>
                    <p className="mt-0.5 truncate font-display text-sm font-bold text-[#161320]">
                      {item.title}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[#161320] tabular-nums">
                      {formatUsd(item.priceUsd)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="rounded-lg p-1.5 text-[#5C576B] hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Coupon Input */}
              <div className="pt-2">
                <label htmlFor="cart-coupon" className="block text-xs font-semibold text-[#161320]">
                  Discount Code (USD)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C576B]" />
                    <input
                      id="cart-coupon"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Try FOX20"
                      className="w-full rounded-lg border border-[#E6E2F0] py-2 pl-9 pr-3 text-sm text-[#161320] uppercase focus:border-[#6D4BB3] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="rounded-lg border border-[#E6E2F0] bg-[#FAFAFC] px-4 py-2 text-xs font-semibold text-[#161320] hover:bg-[#EFEAF9] transition-colors whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>
                {appliedCoupon && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    Code {appliedCoupon.code} applied ({appliedCoupon.discountPercent}% off)
                  </p>
                )}
                {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && !shopifyUrlResult && (
          <div className="border-t border-[#E6E2F0] bg-[#FAFAFC] px-6 py-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#5C576B]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatUsd(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span className="font-mono tabular-nums">-{formatUsd(discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#E6E2F0] pt-2 font-display text-base font-bold text-[#161320]">
                <span>Total (USD)</span>
                <span className="font-mono tabular-nums">{formatUsd(total)}</span>
              </div>
            </div>

            {!shopifyStatus?.configured && total > 0 && (
              <div className="mt-3 rounded-lg border border-[#E6E2F0] bg-white p-3 text-xs text-[#5C576B]">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-[#6D4BB3] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#161320]">Shopify Credentials Required for Live Payment</p>
                    <p className="mt-0.5">
                      Configure <span className="font-mono">SHOPIFY_STORE_DOMAIN</span> and{' '}
                      <span className="font-mono">SHOPIFY_STOREFRONT_ACCESS_TOKEN</span> in Secrets, or test instant digital delivery with the Free Starter Crate &amp; Barrel Kit.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {checkoutError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
                {checkoutError}
              </p>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleCheckout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#B9A0E8] px-5 py-3 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3] disabled:opacity-60 transition-colors"
            >
              <span>
                {!user
                  ? 'Sign In to Checkout'
                  : submitting
                    ? 'Preparing Checkout...'
                    : total === 0
                      ? 'Claim Free Assets & Download'
                      : 'Checkout with Shopify'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
