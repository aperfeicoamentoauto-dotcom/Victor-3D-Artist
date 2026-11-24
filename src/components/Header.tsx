import { Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { MASCOT_IMAGE_URL } from '../lib/api';

export type AppRoute =
  | 'home'
  | 'catalog'
  | 'packs'
  | 'categories'
  | 'product'
  | 'account'
  | 'admin'
  | 'policies';

interface HeaderProps {
  currentRoute: AppRoute;
  cartCount: number;
  onNavigate: (route: AppRoute, param?: string) => void;
  onOpenCart: () => void;
}

export function Header({ currentRoute, cartCount, onNavigate, onOpenCart }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ label: string; route: AppRoute }> = [
    { label: 'Catalog', route: 'catalog' },
    { label: '3D Packs', route: 'packs' },
    { label: 'Categories', route: 'categories' },
    { label: 'Account', route: 'account' },
    { label: 'Admin', route: 'admin' },
  ];

  const handleNav = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E6E2F0] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-left font-display text-lg font-bold tracking-tight text-[#161320] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6D4BB3]"
        >
          <img
            src={MASCOT_IMAGE_URL}
            alt="Senhor Raposa Mascot"
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-lg object-cover border border-[#E6E2F0]"
          />
          <span>Fox Boy's 3D Assets</span>
        </button>

        {/* Zone 2: Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5C576B]">
          {navItems.map((item) => {
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNav(item.route)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#161320] ${
                  active
                    ? 'text-[#161320] underline decoration-[#B9A0E8] decoration-2 underline-offset-8 font-semibold'
                    : ''
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="flex items-center gap-2 rounded-lg bg-[#B9A0E8] px-4 py-2 text-sm font-semibold text-[#161320] hover:bg-[#ab8ee3] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#161320]"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="tabular-nums">Cart ({cartCount})</span>
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E6E2F0] text-[#161320] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E6E2F0] bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNav(item.route)}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  currentRoute === item.route
                    ? 'bg-[#EFEAF9] text-[#161320] font-semibold'
                    : 'text-[#5C576B] hover:bg-[#FAFAFC]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
