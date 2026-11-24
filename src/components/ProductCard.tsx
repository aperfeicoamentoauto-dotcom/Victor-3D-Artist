import { Box, Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { formatUsd } from '../lib/api';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  inCart: boolean;
  onView: (slug: string) => void;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, inCart, onView, onAddToCart }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-xl border border-[#E6E2F0] bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <button
          type="button"
          onClick={() => onView(product.slug)}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-[#F5F2FA] text-left focus-visible:outline-2 focus-visible:outline-[#6D4BB3]"
        >
          {!imgError ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#EFEAF9] to-[#F9F8FC] p-6 text-center">
              <Box className="h-10 w-10 text-[#6D4BB3]" />
              <span className="text-xs font-medium text-[#5C576B]">{product.title}</span>
            </div>
          )}
        </button>

        <div className="p-5 pb-3">
          {/* Clean unboxed metadata per Zero-Pill Discipline */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#5C576B]">
            <span>{product.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{product.isPack ? `${product.modelCount} Models Pack` : 'Single Model'}</span>
            {product.isBestseller && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#6D4BB3] font-semibold">Best Seller</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onView(product.slug)}
            className="mt-2 block text-left font-display text-lg font-bold leading-snug text-[#161320] hover:text-[#6D4BB3] transition-colors"
          >
            {product.title}
          </button>

          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#5C576B]">
            {product.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[#F0ECF8] px-5 py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base font-bold text-[#161320] tabular-nums">
            {formatUsd(product.priceUsd)}
          </span>
          {product.compareAtUsd !== null && product.compareAtUsd > product.priceUsd && (
            <span className="text-xs text-[#8D879E] line-through tabular-nums">
              {formatUsd(product.compareAtUsd)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddToCart(product)}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            inCart
              ? 'bg-[#EFEAF9] text-[#161320] border border-[#B9A0E8]'
              : 'bg-[#161320] text-white hover:bg-[#2E2842]'
          }`}
        >
          {inCart ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{inCart ? 'In Cart' : 'Add to Cart'}</span>
        </button>
      </div>
    </article>
  );
}
