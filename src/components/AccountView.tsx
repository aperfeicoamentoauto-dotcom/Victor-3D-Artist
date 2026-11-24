import {
  Download,
  ExternalLink,
  FolderDown,
  HelpCircle,
  KeyRound,
  LogOut,
  Receipt,
  User,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, formatBytes, formatUsd, MASCOT_IMAGE_URL, setInMemoryAuthToken } from '../lib/api';
import type { LibraryItem, Order, SupportTicket, UserProfile } from '../types';
import type { AppRoute } from './Header';

interface AccountViewProps {
  user: UserProfile | null;
  onAuthSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function AccountView({ user, onAuthSuccess, onLogout, onNavigate }: AccountViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('United States');
  const [studioName, setStudioName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tab, setTab] = useState<'library' | 'orders' | 'profile' | 'support'>('library');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Profile & password update states
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileCountry, setProfileCountry] = useState(user?.country || 'United States');
  const [profileStudio, setProfileStudio] = useState(user?.studioName || '');
  const [profileSaved, setProfileSaved] = useState<string | null>(null);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passStatus, setPassStatus] = useState<string | null>(null);

  // Support ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketOrder, setTicketOrder] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.name);
    setProfileCountry(user.country);
    setProfileStudio(user.studioName);
    setLoadingData(true);
    Promise.all([api.getLibrary(), api.getOrders(), api.getTickets()])
      .then(([lib, ords, tix]) => {
        setLibrary(lib);
        setOrders(ords);
        setTickets(tix);
      })
      .catch((err) => {
        setDownloadError(err instanceof Error ? err.message : 'Unable to load account records.');
      })
      .finally(() => setLoadingData(false));
  }, [user]);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setSubmitting(true);
    try {
      if (authMode === 'login') {
        const res = await api.login({ email, password });
        setInMemoryAuthToken(res.token);
        onAuthSuccess(res.user);
      } else if (authMode === 'register') {
        const res = await api.register({ email, password, name, country, studioName });
        setInMemoryAuthToken(res.token);
        onAuthSuccess(res.user);
      } else if (authMode === 'forgot') {
        const res = await api.forgotPassword(email);
        setAuthInfo(res.message);
      } else if (authMode === 'reset') {
        const res = await api.resetPassword({ email, resetCode, newPassword: password });
        setAuthInfo(res.message);
        setAuthMode('login');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (token: string, fileName: string, fileId: string) => {
    setDownloadError(null);
    setDownloadingId(fileId);
    try {
      await api.downloadAssetFile(token, fileName);
      const updated = await api.getLibrary();
      setLibrary(updated);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSaved(null);
    try {
      const res = await api.updateProfile({
        name: profileName,
        country: profileCountry,
        studioName: profileStudio,
      });
      onAuthSuccess(res.user);
      setProfileSaved('Profile saved.');
    } catch (err) {
      setProfileSaved(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassStatus(null);
    try {
      await api.changePassword({ currentPassword: currPass, newPassword: newPass });
      setCurrPass('');
      setNewPass('');
      setPassStatus('Password updated securely.');
    } catch (err) {
      setPassStatus(err instanceof Error ? err.message : 'Failed to update password.');
    }
  };

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    setTicketStatus(null);
    try {
      const created = await api.createTicket({
        subject: ticketSubject,
        message: ticketMessage,
        orderNumber: ticketOrder || undefined,
      });
      setTickets((prev) => [created, ...prev]);
      setTicketSubject('');
      setTicketOrder('');
      setTicketMessage('');
      setTicketStatus('Support ticket submitted.');
    } catch (err) {
      setTicketStatus(err instanceof Error ? err.message : 'Unable to submit ticket.');
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#E6E2F0] bg-white md:grid-cols-12">
          <div className="bg-[#EFEAF9] p-8 md:col-span-5 flex flex-col justify-between">
            <div>
              <img
                src={MASCOT_IMAGE_URL}
                alt="Senhor Raposa Mascot"
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-2xl object-cover border-2 border-white shadow-sm"
              />
              <h1 className="mt-5 font-display text-2xl font-extrabold text-[#161320]">
                Welcome back, Creator
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5C576B]">
                Sign in to access your purchased 3D models, download updated pack versions, view USD receipts, or contact Senhor Raposa's support team.
              </p>
            </div>
            <p className="mt-8 text-xs text-[#5C576B]">
              Protected digital downloads · Worldwide USD billing via Shopify
            </p>
          </div>

          <div className="p-8 md:col-span-7">
            <div className="flex gap-2 border-b border-[#E6E2F0] pb-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`rounded-lg px-3 py-1.5 ${
                  authMode === 'login' ? 'bg-[#161320] text-white' : 'text-[#5C576B] hover:text-[#161320]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`rounded-lg px-3 py-1.5 ${
                  authMode === 'register' ? 'bg-[#161320] text-white' : 'text-[#5C576B] hover:text-[#161320]'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('forgot');
                  setAuthError(null);
                }}
                className={`rounded-lg px-3 py-1.5 ${
                  authMode === 'forgot' || authMode === 'reset'
                    ? 'bg-[#161320] text-white'
                    : 'text-[#5C576B] hover:text-[#161320]'
                }`}
              >
                Recover Password
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#161320]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm focus:border-[#6D4BB3] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#161320]">Country / Region</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3 py-2.5 text-sm focus:border-[#6D4BB3] focus:outline-none"
                      >
                        <option>United States</option>
                        <option>Canada</option>
                        <option>United Kingdom</option>
                        <option>Europe</option>
                        <option>Asia</option>
                        <option>Brazil</option>
                        <option>Australia</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#161320]">
                        Studio / Roblox Handle (Optional)
                      </label>
                      <input
                        type="text"
                        value={studioName}
                        onChange={(e) => setStudioName(e.target.value)}
                        placeholder="PixelFox Studio"
                        className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm focus:border-[#6D4BB3] focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#161320]">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@studio.com"
                  className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm focus:border-[#6D4BB3] focus:outline-none"
                />
              </div>

              {authMode === 'reset' && (
                <div>
                  <label className="block text-xs font-semibold text-[#161320]">Recovery Code</label>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="8-character code"
                    className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm font-mono uppercase focus:border-[#6D4BB3] focus:outline-none"
                  />
                </div>
              )}

              {authMode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-semibold text-[#161320]">
                    {authMode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm focus:border-[#6D4BB3] focus:outline-none"
                  />
                </div>
              )}

              {authMode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setAuthMode('reset')}
                  className="text-xs font-medium text-[#6D4BB3] hover:underline"
                >
                  Already have a recovery code? Enter it here
                </button>
              )}

              {authError && (
                <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-xs text-red-700 border border-red-200">
                  {authError}
                </p>
              )}
              {authInfo && (
                <p className="rounded-lg bg-[#EFEAF9] px-3.5 py-2.5 text-xs text-[#161320] border border-[#B9A0E8]">
                  {authInfo}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#B9A0E8] px-5 py-3 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3] disabled:opacity-60 transition-colors"
              >
                {submitting
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Sign In'
                    : authMode === 'register'
                      ? 'Create Customer Account'
                      : authMode === 'forgot'
                        ? 'Request Recovery'
                        : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E6E2F0] bg-[#EFEAF9]/55 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img
            src={MASCOT_IMAGE_URL}
            alt="Senhor Raposa"
            referrerPolicy="no-referrer"
            className="h-14 w-14 rounded-xl object-cover border border-white shadow-sm"
          />
          <div>
            <p className="text-xs font-medium text-[#5C576B]">
              {user.country} {user.studioName ? `· ${user.studioName}` : ''}
            </p>
            <h1 className="font-display text-2xl font-extrabold text-[#161320]">
              {user.name}'s Asset Library
            </h1>
            <p className="text-xs text-[#5C576B]">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E6E2F0] bg-white px-4 py-2 text-xs font-semibold text-[#161320] hover:bg-[#FAFAFC] self-start sm:self-auto"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-[#E6E2F0] pb-3">
        {[
          { id: 'library', label: 'My Downloads', icon: FolderDown },
          { id: 'orders', label: 'Purchase History', icon: Receipt },
          { id: 'profile', label: 'Profile & Password', icon: User },
          { id: 'support', label: 'Support', icon: HelpCircle },
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

      {downloadError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {tab === 'library' && (
        <div className="mt-6">
          {loadingData ? (
            <p className="text-sm text-[#5C576B]">Loading your acquired 3D assets...</p>
          ) : library.length === 0 ? (
            <div className="rounded-xl border border-[#E6E2F0] bg-[#FAFAFC] p-10 text-center">
              <FolderDown className="mx-auto h-10 w-10 text-[#B9A0E8]" />
              <h2 className="mt-3 font-display text-lg font-bold text-[#161320]">
                No assets in your library yet
              </h2>
              <p className="mt-1 text-sm text-[#5C576B]">
                Purchased packs and free sample kits appear here automatically with secure download links.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className="mt-5 rounded-lg bg-[#B9A0E8] px-5 py-2.5 text-sm font-bold text-[#161320] hover:bg-[#ab8ee3]"
              >
                Browse 3D Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {library.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-xl border border-[#E6E2F0] bg-white p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#F0ECF8] pb-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-16 w-20 rounded-lg object-cover bg-[#F5F2FA]"
                      />
                      <div>
                        <p className="text-xs font-medium text-[#5C576B]">
                          {item.platform} · Order {item.orderNumber} · {item.licenseType}
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#161320]">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('product', item.slug)}
                      className="text-xs font-semibold text-[#6D4BB3] hover:underline self-start sm:self-auto"
                    >
                      View Asset Specs
                    </button>
                  </div>

                  <div className="mt-4 divide-y divide-[#F0ECF8]">
                    {item.files.map((f) => (
                      <div
                        key={f.fileId}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#161320]">{f.fileName}</p>
                          <p className="text-xs text-[#5C576B]">
                            Format {f.format} · v{f.version} · {formatBytes(f.fileSizeBytes)} · Downloaded{' '}
                            <span className="tabular-nums">{f.downloadCount}</span>x
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={downloadingId === f.fileId}
                          onClick={() => handleDownload(f.downloadToken, f.fileName, f.fileId)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#161320] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2E2842] disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{downloadingId === f.fileId ? 'Preparing...' : 'Download File'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-6 space-y-4">
          {orders.length === 0 ? (
            <p className="text-sm text-[#5C576B]">No orders recorded yet.</p>
          ) : (
            orders.map((ord) => (
              <div key={ord.id} className="rounded-xl border border-[#E6E2F0] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0ECF8] pb-3">
                  <div>
                    <p className="font-display text-base font-bold text-[#161320]">
                      Order {ord.orderNumber}
                    </p>
                    <p className="text-xs text-[#5C576B]">
                      {new Date(ord.createdAt).toLocaleString()} · Provider: {ord.paymentProvider}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#6D4BB3]">
                      Status: {ord.status}
                    </span>
                    <span className="font-mono text-base font-bold text-[#161320] tabular-nums">
                      {formatUsd(ord.totalUsd)}
                    </span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-[#5C576B]">
                  {ord.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.title}</span>
                      <span className="font-mono tabular-nums">{formatUsd(item.priceUsd)}</span>
                    </li>
                  ))}
                </ul>
                {ord.status === 'pending' && ord.shopifyCheckoutUrl && (
                  <a
                    href={ord.shopifyCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#B9A0E8] px-4 py-2 text-xs font-bold text-[#161320]"
                  >
                    <span>Resume Shopify Checkout</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <form onSubmit={handleSaveProfile} className="rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#161320]">Profile Information</h2>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Display Name</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Country / Market</label>
              <input
                type="text"
                value={profileCountry}
                onChange={(e) => setProfileCountry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Studio / Roblox Group</label>
              <input
                type="text"
                value={profileStudio}
                onChange={(e) => setProfileStudio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            {profileSaved && <p className="text-xs font-medium text-[#6D4BB3]">{profileSaved}</p>}
            <button
              type="submit"
              className="rounded-lg bg-[#161320] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#2E2842]"
            >
              Save Profile
            </button>
          </form>

          <form onSubmit={handleChangePassword} className="rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#6D4BB3]" />
              <h2 className="font-display text-lg font-bold text-[#161320]">Update Password</h2>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Current Password</label>
              <input
                type="password"
                required
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">New Password (8+ chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            {passStatus && <p className="text-xs font-medium text-[#6D4BB3]">{passStatus}</p>}
            <button
              type="submit"
              className="rounded-lg bg-[#B9A0E8] px-5 py-2.5 text-xs font-bold text-[#161320] hover:bg-[#ab8ee3]"
            >
              Change Password
            </button>
          </form>
        </div>
      )}

      {tab === 'support' && (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleCreateTicket}
            className="lg:col-span-5 rounded-xl border border-[#E6E2F0] bg-white p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-[#161320]">Contact Support</h2>
            <p className="text-xs text-[#5C576B]">
              Need help importing an .RBXMX or .FBX file into Roblox Studio or Blender? Send us a request.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Subject</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Import question for Sports Car Pack"
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Order Number (Optional)</label>
              <input
                type="text"
                value={ticketOrder}
                onChange={(e) => setTicketOrder(e.target.value)}
                placeholder="FB-123456"
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161320]">Message</label>
              <textarea
                required
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E6E2F0] px-3.5 py-2.5 text-sm"
              />
            </div>
            {ticketStatus && <p className="text-xs font-medium text-[#6D4BB3]">{ticketStatus}</p>}
            <button
              type="submit"
              className="rounded-lg bg-[#B9A0E8] px-5 py-2.5 text-xs font-bold text-[#161320] hover:bg-[#ab8ee3]"
            >
              Submit Support Request
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-display text-lg font-bold text-[#161320]">Your Support Tickets</h2>
            {tickets.length === 0 ? (
              <p className="text-sm text-[#5C576B]">No support requests submitted.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-[#E6E2F0] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-[#161320]">{t.subject}</p>
                    <span className="text-xs font-semibold uppercase text-[#6D4BB3]">{t.status}</span>
                  </div>
                  {t.orderNumber && (
                    <p className="mt-0.5 text-xs text-[#5C576B]">Order: {t.orderNumber}</p>
                  )}
                  <p className="mt-2 text-sm text-[#5C576B]">{t.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
