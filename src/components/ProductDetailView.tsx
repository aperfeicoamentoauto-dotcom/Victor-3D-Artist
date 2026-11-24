import {
  ArrowLeft,
  Box,
  Check,
  FileArchive,
  Image as ImageIcon,
  Layers,
  PlayCircle,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useState } from 'react';
import { formatBytes, formatUsd } from '../lib/api';
import type { Product } from '../types';
import type { AppRoute } from './Header';
import { ThreeAssetViewer } from './ThreeAssetViewer';

interface ProductDetailViewProps {
  product: Product;
  inCart: boolean;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onBack: () => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function ProductDetailView({
  product,
  inCart,
  onAddToCart,
  onBuyNow,
  onBack,
  onNavigate,
}: ProductDetailViewProps) {
  const [viewMode, setViewMode] = useState<'3d' | 'image' | 'video'>('3d');
  const [imgError, setImgError] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C576B] hover:text-[#161320] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Catalog</span>
      </button>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Media & Interactive 3D Viewport */}
        <div className="lg:col-span-7 space-y-4">
          {viewMode === '3d' ? (
            <ThreeAssetViewer
              preset={product.threePreset}
              title={product.title}
              fallbackImage={product.imageUrl}
            />
          ) : viewMode === 'video' && product.videoUrl ? (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E6E2F0] bg-[#161320]">
              <video
                src={product.videoUrl}
                controls
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E6E2F0] bg-[#F5F2FA]">
              {!imgError ? (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#EFEAF9]">
                  <Box className="h-12 w-12 text-[#6D4BB3]" />
                  <span className="text-sm font-medium text-[#5C576B]">{product.title}</span>
                </div>
              )}
            </div>
          )}

          {/* Media Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === '3d'
                  ? 'bg-[#161320] text-white'
                  : 'border border-[#E6E2F0] bg-white text-[#5C576B] hover:bg-[#EFEAF9] hover:text-[#161320]'
              }`}
            >
              <Box className="h-4 w-4" />
              <span>Interactive 3D Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('image')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'image'
                  ? 'bg-[#161320] text-white'
                  : 'border border-[#E6E2F0] bg-white text-[#5C576B] hover:bg-[#EFEAF9] hover:text-[#161320]'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Studio Render</span>
            </button>
            {product.videoUrl && (
              <button
                type="button"
                onClick={() => setViewMode('video')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  viewMode === 'video'
                    ? 'bg-[#161320] text-white'
                    : 'border border-[#E6E2F0] bg-white text-[#5C576B] hover:bg-[#EFEAF9] hover:text-[#161320]'
                }`}
              >
                <PlayCircle className="h-4 w-4" />
                <span>Demo Video</span>
              </button>
            )}
          </div>

          {/* Included Files Breakdown */}
          {product.files && product.files.length > 0 && (
            <div className="rounded-xl border border-[#E6E2F0] bg-[#FAFAFC] p-5">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-[#6D4BB3]" />
                <h2 className="font-display text-sm font-bold text-[#161320]">
                  Included Digital Files ({product.files.length})
                </h2>
              </div>
              <div className="mt-3 divide-y divide-[#E6E2F0]">
                {product.files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#161320]">{f.fileName}</p>
                      <p className="text-xs text-[#5C576B]">
                        Format {f.format} · v{f.version}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-[#5C576B] tabular-nums">
                      {formatBytes(f.fileSizeBytes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Contiguous Purchase Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6 rounded-xl border border-[#E6E2F0] bg-white p-6 sm:p-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#5C576B]">
              <span>{product.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{product.categoryName || product.categorySlug}</span>
              <span aria-hidden="true">·</span>
              <span>{product.isPack ? `${product.modelCount} Models Pack` : 'Individual Asset'}</span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#161320] sm:text-3xl text-balance">
              {product.title}
            </h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-3xl font-extrabold text-[#161320] tabular-nums">
                {formatUsd(product.priceUsd)}
              </span>
              {product.compareAtUsd !== null && product.compareAtUsd > product.priceUsd && (
                <>
                  <span className="text-base text-[#8D879E] line-through tabular-nums">
                    {formatUsd(product.compareAtUsd)}
                  </span>
                  <span className="text-xs font-semibold text-[#6D4BB3]">
                    Save {Math.round(((product.compareAtUsd - product.priceUsd) / product.compareAtUsd) * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#5C576B]">{product.description}</p>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                inCart
                  ? 'bg-[#EFEAF9] text-[#161320] border border-[#B9A0E8]'
                  : 'border border-[#161320] bg-white text-[#161320] hover:bg-[#FAFAFC]'
              }`}
            >
              {inCart ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              <span>{inCart ? 'In Cart' : 'Add to Cart'}</span>
            </button>
            <button
              type="button"
              onClick={() => onBuyNow(product)}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#B9A0E8] px-4 py-3 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3] transition-colors whitespace-nowrap"
            >
              <span>{product.priceUsd === 0 ? 'Claim Free Now' : 'Buy Now'}</span>
            </button>
          </div>

          {/* Technical Specifications */}
          <div className="border-t border-[#E6E2F0] pt-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#161320]">
              <Layers className="h-4 w-4 text-[#6D4BB3]" />
              <span>Technical Specifications</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#5C576B]">Models Included</dt>
                <dd className="font-semibold text-[#161320] tabular-nums">{product.modelCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#5C576B]">Polygon Count</dt>
                <dd className="font-mono text-xs font-semibold text-[#161320] tabular-nums">
                  {product.polyCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5C576B]">Formats</dt>
                <dd className="font-mono text-xs font-semibold text-[#161320]">
                  {product.formats.join(', ')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#5C576B]">Textures &amp; Materials</dt>
                <dd className="font-semibold text-[#161320]">
                  {product.texturesIncluded ? 'Included (PBR / UV)' : 'Vertex Colored'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-[#5C576B]">Compatibility</dt>
                <dd className="font-medium text-[#161320]">{product.compatibility.join(' · ')}</dd>
              </div>
            </dl>
          </div>

          {/* Usage License */}
          <div className="border-t border-[#E6E2F0] pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#161320]">
                <ShieldCheck className="h-4 w-4 text-[#6D4BB3]" />
                <span>{product.licenseType}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('policies')}
                className="text-xs font-medium text-[#6D4BB3] hover:underline"
              >
                Full License
              </button>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#5C576B]">
              <li>
                {product.license.commercialUse ? 'Allowed:' : 'Restricted:'} Commercial &amp; monetized Roblox / indie games
              </li>
              <li>
                {product.license.personalUse ? 'Allowed:' : 'Restricted:'} Personal &amp; educational projects
              </li>
              <li>
                {product.license.noRedistribution
                  ? 'Not allowed: Redistributing or reselling raw 3D source files'
                  : 'Redistribution terms specified in notes'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
