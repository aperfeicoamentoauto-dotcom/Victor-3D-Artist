import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  attachSessionCookie,
  clearSessionCookie,
  createSession,
  getAdminPasscodeFromEnv,
  hashPassword,
  hashToken,
  hasAnyAdminUser,
  mapUserRow,
  requireAdmin,
  requireAuth,
  resolveRequestAuth,
  verifyEnvAdminPasscode,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  STORAGE_ROOT,
  createPackBundleFiles,
  db,
  mapProductRow,
  seedInitialCatalogIfEmpty,
} from './server/db.ts';
import {
  createShopifyCheckoutCart,
  getPublicShopifyStatus,
  syncProductToShopifyAdmin,
  verifyShopifyWebhookHmac,
} from './server/shopify.ts';
import type { AssetFormat, LicenseTerms, PlatformCategory, ThreePreset } from './src/types.ts';

const ALLOWED_FORMATS: AssetFormat[] = ['.BLEND', '.FBX', '.OBJ', '.RBXM', '.RBXMX', '.ZIP'];
const ALLOWED_PLATFORMS: PlatformCategory[] = ['Roblox Studio', 'Roblox UGC', 'Game Development'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function issueDownloadTokensForOrder(orderId: string, userId: string): void {
  const items = db
    .prepare('SELECT product_id FROM order_items WHERE order_id = ?')
    .all(orderId) as Array<{ product_id: string }>;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString();

  const insertTok = db.prepare(`
    INSERT INTO download_tokens (id, token, user_id, order_id, product_id, file_id, expires_at, download_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  for (const item of items) {
    const files = db
      .prepare('SELECT id FROM product_files WHERE product_id = ?')
      .all(item.product_id) as Array<{ id: string }>;

    for (const file of files) {
      const existing = db
        .prepare('SELECT id FROM download_tokens WHERE user_id = ? AND order_id = ? AND file_id = ?')
        .get(userId, orderId, file.id);
      if (!existing) {
        insertTok.run(
          crypto.randomUUID(),
          crypto.randomBytes(24).toString('hex'),
          userId,
          orderId,
          item.product_id,
          file.id,
          expiresAt,
          now.toISOString()
        );
      }
    }
  }
}

async function startServer() {
  await seedInitialCatalogIfEmpty();

  const app = express();
  app.set('trust proxy', 1);

  // Shopify orders/paid webhook MUST receive raw Buffer body before express.json()
  app.post(
    '/api/webhooks/shopify/orders-paid',
    express.raw({ type: 'application/json', limit: '2mb' }),
    (req, res) => {
      const rawBody = req.body as Buffer;
      const hmac = req.headers['x-shopify-hmac-sha256'] as string | undefined;

      if (!Buffer.isBuffer(rawBody) || !verifyShopifyWebhookHmac(rawBody, hmac)) {
        res.status(401).json({ error: 'Invalid Shopify webhook signature.' });
        return;
      }

      try {
        const payload = JSON.parse(rawBody.toString('utf8')) as {
          id?: number | string;
          order_number?: number | string;
          email?: string;
          checkout_token?: string;
          line_items?: Array<{ product_id?: number | string; variant_id?: number | string; title?: string; price?: string }>;
          total_price?: string;
        };

        const shopifyOrderId = payload.id ? String(payload.id) : null;
        const email = (payload.email || '').trim().toLowerCase();

        // Try matching pending order by checkout token or customer email
        let orderRow = payload.checkout_token
          ? (db
              .prepare('SELECT * FROM orders WHERE shopify_checkout_id LIKE ? ORDER BY created_at DESC LIMIT 1')
              .get(`%${payload.checkout_token}%`) as Record<string, unknown> | undefined)
          : undefined;

        if (!orderRow && email) {
          orderRow = db
            .prepare("SELECT * FROM orders WHERE lower(customer_email) = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1")
            .get(email) as Record<string, unknown> | undefined;
        }

        if (orderRow) {
          const orderId = String(orderRow.id);
          db.prepare("UPDATE orders SET status = 'paid', shopify_order_id = ? WHERE id = ?").run(
            shopifyOrderId,
            orderId
          );
          const items = db
            .prepare('SELECT product_id FROM order_items WHERE order_id = ?')
            .all(orderId) as Array<{ product_id: string }>;
          for (const item of items) {
            db.prepare('UPDATE products SET sales_count = sales_count + 1 WHERE id = ?').run(item.product_id);
          }
          if (orderRow.user_id) {
            issueDownloadTokensForOrder(orderId, String(orderRow.user_id));
          }
        }

        res.status(200).json({ received: true });
      } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(400).json({ error: 'Malformed webhook payload.' });
      }
    }
  );

  app.use(express.json({ limit: '35mb' }));
  app.use(resolveRequestAuth);

  // CSRF / Origin check for state-changing requests authenticated by cookies
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/webhooks/shopify/orders-paid') {
      return next();
    }
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'Cross-origin mutation blocked.' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid Origin header.' });
        return;
      }
    }
    next();
  });

  // --- Health & Integration Status ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: "Fox Boy's 3D Assets" });
  });

  app.get('/api/shopify/status', (_req, res) => {
    res.json(getPublicShopifyStatus());
  });

  // --- Categories ---
  app.get('/api/categories', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_slug = c.slug) as product_count
         FROM categories c
         ORDER BY c.sort_order ASC, c.name ASC`
      )
      .all() as Array<Record<string, unknown>>;

    res.json(
      rows.map((r) => ({
        id: String(r.id),
        slug: String(r.slug),
        name: String(r.name),
        platform: String(r.platform),
        description: String(r.description),
        sortOrder: Number(r.sort_order),
        productCount: Number(r.product_count || 0),
      }))
    );
  });

  // --- Products Catalog ---
  app.get('/api/products', (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const platform = String(req.query.platform || '').trim();
    const category = String(req.query.category || '').trim();
    const type = String(req.query.type || '').trim(); // 'pack' | 'individual'
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : null;
    const sort = String(req.query.sort || 'bestselling');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push('(lower(p.title) LIKE ? OR lower(p.description) LIKE ? OR lower(p.platform) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (platform && platform !== 'All') {
      conditions.push('p.platform = ?');
      params.push(platform);
    }
    if (category && category !== 'all') {
      conditions.push('p.category_slug = ?');
      params.push(category);
    }
    if (type === 'pack') {
      conditions.push('p.is_pack = 1');
    } else if (type === 'individual') {
      conditions.push('p.is_pack = 0');
    }
    if (minPrice !== null && !Number.isNaN(minPrice)) {
      conditions.push('p.price_usd >= ?');
      params.push(minPrice);
    }
    if (maxPrice !== null && !Number.isNaN(maxPrice)) {
      conditions.push('p.price_usd <= ?');
      params.push(maxPrice);
    }

    let orderBy = 'p.sales_count DESC, p.created_at DESC';
    if (sort === 'newest') orderBy = 'p.is_new DESC, p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price_usd ASC';
    if (sort === 'price_desc') orderBy = 'p.price_usd DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON c.slug = p.category_slug
         ${whereClause}
         ORDER BY ${orderBy}`
      )
      .all(...params) as Array<Record<string, unknown>>;

    res.json(rows.map((r) => mapProductRow(r, true)));
  });

  app.get('/api/products/:slug', (req, res) => {
    const slug = String(req.params.slug || '');
    const row = db
      .prepare(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON c.slug = p.category_slug
         WHERE p.slug = ? OR p.id = ?
         LIMIT 1`
      )
      .get(slug, slug) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: '3D asset not found.' });
      return;
    }
    res.json(mapProductRow(row, true));
  });

  // --- Coupons ---
  app.post('/api/coupons/validate', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Enter a coupon code.' });
      return;
    }
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code) as
      | Record<string, unknown>
      | undefined;

    if (!coupon) {
      res.status(404).json({ error: 'Coupon code is invalid or inactive.' });
      return;
    }
    if (coupon.expires_at && new Date(String(coupon.expires_at)) < new Date()) {
      res.status(400).json({ error: 'This coupon has expired.' });
      return;
    }
    if (coupon.max_uses !== null && Number(coupon.uses_count) >= Number(coupon.max_uses)) {
      res.status(400).json({ error: 'Coupon usage limit reached.' });
      return;
    }

    res.json({
      code: String(coupon.code),
      discountPercent: Number(coupon.discount_percent),
    });
  });

  // --- Authentication & Customer Account ---
  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    const adminPasscodeConfigured = Boolean(getAdminPasscodeFromEnv());
    const needsAdminClaim = !adminPasscodeConfigured && !hasAnyAdminUser();
    res.json({
      user: req.user || null,
      needsAdminClaim,
      adminPasscodeConfigured,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const country = String(req.body?.country || 'United States').trim().slice(0, 80);
    const studioName = String(req.body?.studioName || '').trim().slice(0, 80);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Display name is required.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    // Users always register with 'customer' role; admin elevation requires claim-admin or ADMIN_PASSCODE
    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, role, country, studio_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, email, name.slice(0, 80), passwordHash, 'customer', country, studioName, now);

    const token = createSession(id);
    attachSessionCookie(req, res, token);

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({ user: mapUserRow(userRow), token });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | Record<string, unknown>
      | undefined;

    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = createSession(String(userRow.id));
    attachSessionCookie(req, res, token);
    res.json({ user: mapUserRow(userRow), token });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(req.authToken));
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (user) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 1000 * 60 * 30).toISOString();
      db.prepare(
        'INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).run(crypto.randomUUID(), user.id, hashToken(code), expiresAt, now.toISOString());
    }
    res.json({
      message:
        'If an account matches that email, a password recovery request has been logged. For security, configure an SMTP provider in production or contact store support to issue your recovery code.',
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const resetCode = String(req.body?.resetCode || '').trim().toUpperCase();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !resetCode || newPassword.length < 8) {
      res.status(400).json({ error: 'Email, recovery code, and new password (8+ chars) are required.' });
      return;
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (!user) {
      res.status(400).json({ error: 'Invalid recovery details.' });
      return;
    }

    const resetRow = db
      .prepare(
        'SELECT * FROM password_resets WHERE user_id = ? AND token_hash = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(user.id, hashToken(resetCode), new Date().toISOString()) as { id: string } | undefined;

    if (!resetRow) {
      res.status(400).json({ error: 'Recovery code is invalid or expired.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    res.json({ ok: true, message: 'Password updated. Please sign in.' });
  });

  // First-run Admin Claim (locks automatically once an admin exists or ADMIN_PASSCODE is set)
  app.post('/api/auth/claim-admin', (req, res) => {
    if (getAdminPasscodeFromEnv()) {
      res.status(403).json({ error: 'ADMIN_PASSCODE is configured on the server. Use Owner Sign In.' });
      return;
    }
    if (hasAnyAdminUser()) {
      res.status(403).json({ error: 'Owner account has already been claimed.' });
      return;
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !name) {
      res.status(400).json({ error: 'Valid owner email, name, and password (8+ chars) are required.' });
      return;
    }

    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    let userId: string;
    if (existing) {
      userId = existing.id;
      db.prepare("UPDATE users SET role = 'admin', password_hash = ?, name = ? WHERE id = ?").run(
        hashPassword(password),
        name.slice(0, 80),
        userId
      );
    } else {
      userId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash, role, country, studio_name, created_at) VALUES (?, ?, ?, ?, 'admin', 'United States', ?, ?)"
      ).run(userId, email, name.slice(0, 80), hashPassword(password), "Fox Boy's 3D Assets", now);
    }

    const token = createSession(userId);
    attachSessionCookie(req, res, token);
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    res.status(201).json({ user: mapUserRow(userRow), token });
  });

  app.post('/api/auth/admin-login', (req, res) => {
    const passcode = String(req.body?.passcode || '');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (getAdminPasscodeFromEnv() && passcode) {
      if (!verifyEnvAdminPasscode(passcode)) {
        res.status(401).json({ error: 'Invalid owner passcode.' });
        return;
      }
      // Find or create the owner session record
      let ownerRow = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get() as
        | Record<string, unknown>
        | undefined;
      if (!ownerRow) {
        const ownerId = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare(
          "INSERT INTO users (id, email, name, password_hash, role, country, studio_name, created_at) VALUES (?, ?, ?, ?, 'admin', 'United States', ?, ?)"
        ).run(
          ownerId,
          'owner@foxboys3d.com',
          'Store Owner',
          hashPassword(crypto.randomBytes(24).toString('hex')),
          "Fox Boy's 3D Assets",
          now
        );
        ownerRow = db.prepare('SELECT * FROM users WHERE id = ?').get(ownerId) as Record<string, unknown>;
      }
      const token = createSession(String(ownerRow.id));
      attachSessionCookie(req, res, token);
      res.json({ user: mapUserRow(ownerRow), token });
      return;
    }

    const adminRow = db
      .prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'")
      .get(email) as Record<string, unknown> | undefined;

    if (!adminRow || !verifyPassword(password, String(adminRow.password_hash))) {
      res.status(401).json({ error: 'Invalid owner credentials.' });
      return;
    }

    const token = createSession(String(adminRow.id));
    attachSessionCookie(req, res, token);
    res.json({ user: mapUserRow(adminRow), token });
  });

  app.patch('/api/account/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const name = String(req.body?.name || req.user!.name).trim().slice(0, 80);
    const country = String(req.body?.country || req.user!.country).trim().slice(0, 80);
    const studioName = String(req.body?.studioName ?? req.user!.studioName).trim().slice(0, 80);

    if (!name) {
      res.status(400).json({ error: 'Name cannot be empty.' });
      return;
    }

    db.prepare('UPDATE users SET name = ?, country = ?, studio_name = ? WHERE id = ?').run(
      name,
      country,
      studioName,
      req.user!.id
    );
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;
    res.json({ user: mapUserRow(updated) });
  });

  app.post('/api/account/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as {
      password_hash: string;
    };
    if (!verifyPassword(currentPassword, row.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.user!.id);
    res.json({ ok: true });
  });

  // --- Orders, Free Sample Claim, & Real Shopify Checkout ---
  app.post('/api/orders/claim-free', requireAuth, (req: AuthenticatedRequest, res) => {
    const productIds = Array.isArray(req.body?.productIds)
      ? (req.body.productIds as unknown[]).map((id) => String(id))
      : [];

    if (productIds.length === 0) {
      res.status(400).json({ error: 'Select at least one free asset to claim.' });
      return;
    }

    const placeholders = productIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
      .all(...productIds) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      res.status(404).json({ error: 'Selected assets not found.' });
      return;
    }

    const products = rows.map((r) => mapProductRow(r, false));
    if (products.some((p) => p.priceUsd > 0)) {
      res.status(400).json({
        error: 'Paid products require Shopify Checkout and cannot be claimed for free.',
      });
      return;
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `FB-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO orders (id, order_number, user_id, customer_email, shopify_order_id, shopify_checkout_id, shopify_checkout_url, status, subtotal_usd, discount_usd, total_usd, coupon_code, payment_provider, created_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, 'paid', 0, 0, 0, NULL, 'free_sample', ?)`
    ).run(orderId, orderNumber, req.user!.id, req.user!.email, now);

    const insertItem = db.prepare(
      'INSERT INTO order_items (id, order_id, product_id, title, price_usd, is_pack) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const p of products) {
      insertItem.run(crypto.randomUUID(), orderId, p.id, p.title, p.priceUsd, p.isPack ? 1 : 0);
      db.prepare('UPDATE products SET sales_count = sales_count + 1 WHERE id = ?').run(p.id);
    }

    issueDownloadTokensForOrder(orderId, req.user!.id);
    res.status(201).json({ orderId, orderNumber, status: 'paid' });
  });

  app.post('/api/shopify/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
    const productIds = Array.isArray(req.body?.productIds)
      ? (req.body.productIds as unknown[]).map((id) => String(id))
      : [];
    const couponCode = req.body?.couponCode ? String(req.body.couponCode).trim().toUpperCase() : null;

    if (productIds.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const placeholders = productIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
      .all(...productIds) as Array<Record<string, unknown>>;

    if (rows.length !== productIds.length) {
      res.status(400).json({ error: 'One or more products in your cart could not be found.' });
      return;
    }

    const products = rows.map((r) => mapProductRow(r, false));
    const subtotalUsd = products.reduce((acc, p) => acc + p.priceUsd, 0);

    let discountPercent = 0;
    if (couponCode) {
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(couponCode) as
        | Record<string, unknown>
        | undefined;
      if (coupon) {
        discountPercent = Number(coupon.discount_percent);
      }
    }

    const discountUsd = Number(((subtotalUsd * discountPercent) / 100).toFixed(2));
    const totalUsd = Number(Math.max(0, subtotalUsd - discountUsd).toFixed(2));

    try {
      const { checkoutUrl, cartId } = await createShopifyCheckoutCart({
        items: products.map((p) => ({ product: p, quantity: 1 })),
        customerEmail: req.user!.email,
        discountCode: couponCode,
      });

      const orderId = crypto.randomUUID();
      const orderNumber = `FB-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO orders (id, order_number, user_id, customer_email, shopify_order_id, shopify_checkout_id, shopify_checkout_url, status, subtotal_usd, discount_usd, total_usd, coupon_code, payment_provider, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'pending', ?, ?, ?, ?, 'shopify', ?)`
      ).run(
        orderId,
        orderNumber,
        req.user!.id,
        req.user!.email,
        cartId,
        checkoutUrl,
        subtotalUsd,
        discountUsd,
        totalUsd,
        couponCode,
        now
      );

      const insertItem = db.prepare(
        'INSERT INTO order_items (id, order_id, product_id, title, price_usd, is_pack) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const p of products) {
        insertItem.run(crypto.randomUUID(), orderId, p.id, p.title, p.priceUsd, p.isPack ? 1 : 0);
      }

      if (couponCode && discountPercent > 0) {
        db.prepare('UPDATE coupons SET uses_count = uses_count + 1 WHERE code = ?').run(couponCode);
      }

      res.json({ orderId, orderNumber, checkoutUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Shopify checkout unavailable.';
      if (msg === 'SHOPIFY_NOT_CONFIGURED') {
        res.status(503).json({
          code: 'SHOPIFY_NOT_CONFIGURED',
          error:
            'Shopify Storefront credentials are not configured yet. Add SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN in Secrets to enable live USD checkout.',
        });
        return;
      }
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res) => {
    const orders = db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id) as Array<Record<string, unknown>>;

    const result = orders.map((o) => {
      const items = db
        .prepare('SELECT * FROM order_items WHERE order_id = ?')
        .all(String(o.id)) as Array<Record<string, unknown>>;
      return {
        id: String(o.id),
        orderNumber: String(o.order_number),
        userId: o.user_id ? String(o.user_id) : null,
        customerEmail: String(o.customer_email),
        shopifyOrderId: o.shopify_order_id ? String(o.shopify_order_id) : null,
        shopifyCheckoutUrl: o.shopify_checkout_url ? String(o.shopify_checkout_url) : null,
        status: String(o.status),
        subtotalUsd: Number(o.subtotal_usd),
        discountUsd: Number(o.discount_usd),
        totalUsd: Number(o.total_usd),
        couponCode: o.coupon_code ? String(o.coupon_code) : null,
        paymentProvider: String(o.payment_provider),
        createdAt: String(o.created_at),
        items: items.map((i) => ({
          id: String(i.id),
          orderId: String(i.order_id),
          productId: String(i.product_id),
          title: String(i.title),
          priceUsd: Number(i.price_usd),
          isPack: Boolean(i.is_pack),
        })),
      };
    });

    res.json(result);
  });

  // --- Customer Acquired Library & Protected Digital Downloads ---
  app.get('/api/library', requireAuth, (req: AuthenticatedRequest, res) => {
    const paidOrders = db
      .prepare(
        `SELECT o.id as order_id, o.order_number, o.created_at as purchased_at, oi.product_id
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.user_id = ? AND o.status = 'paid'
         ORDER BY o.created_at DESC`
      )
      .all(req.user!.id) as Array<{
      order_id: string;
      order_number: string;
      purchased_at: string;
      product_id: string;
    }>;

    // Ensure tokens exist for any newly added product file versions
    for (const row of paidOrders) {
      issueDownloadTokensForOrder(row.order_id, req.user!.id);
    }

    const seenProducts = new Set<string>();
    const library = [];

    for (const row of paidOrders) {
      if (seenProducts.has(row.product_id)) continue;
      seenProducts.add(row.product_id);

      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(row.product_id) as
        | Record<string, unknown>
        | undefined;
      if (!prod) continue;

      const files = db
        .prepare(
          `SELECT pf.id as file_id, pf.file_name, pf.format, pf.file_size_bytes, pf.version, pf.uploaded_at,
                  dt.token as download_token, dt.download_count
           FROM product_files pf
           JOIN download_tokens dt ON dt.file_id = pf.id
           WHERE pf.product_id = ? AND dt.user_id = ? AND dt.order_id = ?
           ORDER BY pf.uploaded_at DESC`
        )
        .all(row.product_id, req.user!.id, row.order_id) as Array<Record<string, unknown>>;

      library.push({
        productId: String(prod.id),
        slug: String(prod.slug),
        title: String(prod.title),
        imageUrl: String(prod.image_url),
        platform: String(prod.platform),
        isPack: Boolean(prod.is_pack),
        modelCount: Number(prod.model_count),
        licenseType: String(prod.license_type),
        purchasedAt: row.purchased_at,
        orderNumber: row.order_number,
        files: files.map((f) => ({
          fileId: String(f.file_id),
          fileName: String(f.file_name),
          format: String(f.format),
          fileSizeBytes: Number(f.file_size_bytes),
          version: String(f.version),
          uploadedAt: String(f.uploaded_at),
          downloadToken: String(f.download_token),
          downloadCount: Number(f.download_count),
        })),
      });
    }

    res.json(library);
  });

  app.get('/api/downloads/:token', requireAuth, (req: AuthenticatedRequest, res) => {
    const token = String(req.params.token || '');
    const record = db
      .prepare(
        `SELECT dt.*, pf.file_name, pf.storage_rel_path
         FROM download_tokens dt
         JOIN product_files pf ON pf.id = dt.file_id
         WHERE dt.token = ?
         LIMIT 1`
      )
      .get(token) as Record<string, unknown> | undefined;

    if (!record) {
      res.status(404).json({ error: 'Download link not found.' });
      return;
    }

    if (String(record.user_id) !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to download this asset.' });
      return;
    }

    if (new Date(String(record.expires_at)) < new Date()) {
      res.status(410).json({ error: 'Download link has expired. Refresh your Library to generate a new link.' });
      return;
    }

    const resolvedPath = path.resolve(STORAGE_ROOT, String(record.storage_rel_path));
    if (!resolvedPath.startsWith(STORAGE_ROOT + path.sep) || !fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Asset file missing on storage.' });
      return;
    }

    db.prepare('UPDATE download_tokens SET download_count = download_count + 1 WHERE id = ?').run(
      String(record.id)
    );

    const safeFileName = path.basename(String(record.file_name)).replace(/["\r\n]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(resolvedPath);
  });

  // --- Support Tickets ---
  app.get('/api/support/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id) as Array<Record<string, unknown>>;
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        customerEmail: String(r.customer_email),
        orderNumber: r.order_number ? String(r.order_number) : null,
        subject: String(r.subject),
        message: String(r.message),
        status: String(r.status),
        createdAt: String(r.created_at),
      }))
    );
  });

  app.post('/api/support/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const subject = String(req.body?.subject || '').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const orderNumber = req.body?.orderNumber ? String(req.body.orderNumber).trim().slice(0, 40) : null;

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO support_tickets (id, user_id, customer_email, order_number, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)"
    ).run(id, req.user!.id, req.user!.email, orderNumber, subject, message, now);

    res.status(201).json({
      id,
      userId: req.user!.id,
      customerEmail: req.user!.email,
      orderNumber,
      subject,
      message,
      status: 'open',
      createdAt: now,
    });
  });

  // --- Admin Panel Routes ---
  app.get('/api/admin/stats', requireAdmin, (_req, res) => {
    const revRow = db
      .prepare("SELECT COALESCE(SUM(total_usd), 0) as rev, COUNT(*) as count FROM orders WHERE status = 'paid'")
      .get() as { rev: number; count: number };
    const pendingRow = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'")
      .get() as { count: number };
    const prodRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
    const packRow = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_pack = 1').get() as { count: number };
    const custRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get() as { count: number };
    const dlRow = db
      .prepare('SELECT COALESCE(SUM(download_count), 0) as count FROM download_tokens')
      .get() as { count: number };
    const topProducts = db
      .prepare('SELECT id, title, sales_count, price_usd, is_pack FROM products ORDER BY sales_count DESC LIMIT 5')
      .all() as Array<Record<string, unknown>>;

    res.json({
      totalRevenueUsd: Number(revRow.rev),
      paidOrdersCount: Number(revRow.count),
      pendingOrdersCount: Number(pendingRow.count),
      totalProducts: Number(prodRow.count),
      totalPacks: Number(packRow.count),
      totalCustomers: Number(custRow.count),
      totalDownloads: Number(dlRow.count),
      topProducts: topProducts.map((p) => ({
        id: String(p.id),
        title: String(p.title),
        salesCount: Number(p.sales_count),
        priceUsd: Number(p.price_usd),
        isPack: Boolean(p.is_pack),
      })),
    });
  });

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const description = String(req.body?.description || '').trim().slice(0, 4000);
    const priceUsd = Number(req.body?.priceUsd);
    const compareAtUsd =
      req.body?.compareAtUsd !== null && req.body?.compareAtUsd !== undefined && req.body?.compareAtUsd !== ''
        ? Number(req.body.compareAtUsd)
        : null;
    const isPack = Boolean(req.body?.isPack);
    const modelCount = Math.max(1, Number(req.body?.modelCount || 1));
    const polyCount = String(req.body?.polyCount || '2,500 tris').trim().slice(0, 60);
    const categorySlug = String(req.body?.categorySlug || 'asset-packs').trim();
    const platform = ALLOWED_PLATFORMS.includes(req.body?.platform) ? req.body.platform : 'Roblox Studio';
    const compatibility = Array.isArray(req.body?.compatibility)
      ? req.body.compatibility.map((x: unknown) => String(x)).slice(0, 10)
      : ['Roblox Studio'];
    const formats = Array.isArray(req.body?.formats)
      ? req.body.formats.filter((f: unknown) => ALLOWED_FORMATS.includes(f as AssetFormat))
      : ['.FBX', '.OBJ', '.RBXMX'];
    const texturesIncluded = req.body?.texturesIncluded !== false;
    const licenseType = String(req.body?.licenseType || 'Standard Commercial & Game License').slice(0, 120);
    const license: LicenseTerms = {
      personalUse: req.body?.license?.personalUse !== false,
      commercialUse: req.body?.license?.commercialUse !== false,
      inGameUse: req.body?.license?.inGameUse !== false,
      noRedistribution: req.body?.license?.noRedistribution !== false,
      noResaleOriginal: req.body?.license?.noResaleOriginal !== false,
      specialNotes: String(req.body?.license?.specialNotes || '').slice(0, 500),
    };
    const imageUrl = String(
      req.body?.imageUrl || '/src/assets/images/pack_sports_cars_1795533988684.jpg'
    ).trim();
    const videoUrl = req.body?.videoUrl ? String(req.body.videoUrl).trim() : null;
    const threePreset: ThreePreset = req.body?.threePreset || 'sports_car';

    if (!title || !description || Number.isNaN(priceUsd) || priceUsd < 0) {
      res.status(400).json({ error: 'Valid title, description, and non-negative USD price are required.' });
      return;
    }

    const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
    let slug = slugify(title) || id;
    const existingSlug = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${slug}-${id.slice(-4)}`;
    }
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO products (
        id, slug, title, description, price_usd, compare_at_usd, is_pack, model_count,
        poly_count, category_slug, platform, compatibility_json, formats_json, textures_included,
        license_type, license_json, image_url, video_url, three_preset, sales_count,
        is_featured, is_bestseller, is_new, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)`
    ).run(
      id,
      slug,
      title,
      description,
      priceUsd,
      compareAtUsd,
      isPack ? 1 : 0,
      modelCount,
      polyCount,
      categorySlug,
      platform,
      JSON.stringify(compatibility),
      JSON.stringify(formats),
      texturesIncluded ? 1 : 0,
      licenseType,
      JSON.stringify(license),
      imageUrl,
      videoUrl,
      threePreset,
      req.body?.isFeatured ? 1 : 0,
      req.body?.isBestseller ? 1 : 0,
      now,
      now
    );

    const files = await createPackBundleFiles(id, slug, title, threePreset, formats, license.specialNotes);
    const insertFile = db.prepare(
      'INSERT INTO product_files (id, product_id, file_name, format, file_size_bytes, version, storage_rel_path, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const f of files) {
      insertFile.run(f.id, id, f.fileName, f.format, f.size, '1.0', f.relPath, now);
    }

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(mapProductRow(row, true));
  });

  app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '');
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const title = String(req.body?.title ?? existing.title).trim().slice(0, 120);
    const description = String(req.body?.description ?? existing.description).trim().slice(0, 4000);
    const priceUsd = req.body?.priceUsd !== undefined ? Number(req.body.priceUsd) : Number(existing.price_usd);
    const compareAtUsd =
      req.body?.compareAtUsd !== undefined
        ? req.body.compareAtUsd === null || req.body.compareAtUsd === ''
          ? null
          : Number(req.body.compareAtUsd)
        : existing.compare_at_usd !== null
          ? Number(existing.compare_at_usd)
          : null;
    const isPack = req.body?.isPack !== undefined ? Boolean(req.body.isPack) : Boolean(existing.is_pack);
    const modelCount =
      req.body?.modelCount !== undefined ? Math.max(1, Number(req.body.modelCount)) : Number(existing.model_count);
    const polyCount = String(req.body?.polyCount ?? existing.poly_count).trim();
    const categorySlug = String(req.body?.categorySlug ?? existing.category_slug).trim();
    const platform = ALLOWED_PLATFORMS.includes(req.body?.platform)
      ? req.body.platform
      : (String(existing.platform) as PlatformCategory);
    const compatibility = Array.isArray(req.body?.compatibility)
      ? req.body.compatibility
      : JSON.parse(String(existing.compatibility_json));
    const formats = Array.isArray(req.body?.formats)
      ? req.body.formats.filter((f: unknown) => ALLOWED_FORMATS.includes(f as AssetFormat))
      : JSON.parse(String(existing.formats_json));
    const texturesIncluded =
      req.body?.texturesIncluded !== undefined
        ? Boolean(req.body.texturesIncluded)
        : Boolean(existing.textures_included);
    const licenseType = String(req.body?.licenseType ?? existing.license_type);
    const license = req.body?.license ?? JSON.parse(String(existing.license_json));
    const imageUrl = String(req.body?.imageUrl ?? existing.image_url).trim();
    const videoUrl = req.body?.videoUrl !== undefined ? (req.body.videoUrl ? String(req.body.videoUrl) : null) : (existing.video_url ? String(existing.video_url) : null);
    const shopifyProductId =
      req.body?.shopifyProductId !== undefined
        ? req.body.shopifyProductId
          ? String(req.body.shopifyProductId)
          : null
        : existing.shopify_product_id
          ? String(existing.shopify_product_id)
          : null;
    const shopifyVariantId =
      req.body?.shopifyVariantId !== undefined
        ? req.body.shopifyVariantId
          ? String(req.body.shopifyVariantId)
          : null
        : existing.shopify_variant_id
          ? String(existing.shopify_variant_id)
          : null;
    const isFeatured = req.body?.isFeatured !== undefined ? Boolean(req.body.isFeatured) : Boolean(existing.is_featured);
    const isBestseller =
      req.body?.isBestseller !== undefined ? Boolean(req.body.isBestseller) : Boolean(existing.is_bestseller);
    const isNew = req.body?.isNew !== undefined ? Boolean(req.body.isNew) : Boolean(existing.is_new);

    if (Number.isNaN(priceUsd) || priceUsd < 0) {
      res.status(400).json({ error: 'Price must be non-negative.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE products SET
        title = ?, description = ?, price_usd = ?, compare_at_usd = ?, is_pack = ?,
        model_count = ?, poly_count = ?, category_slug = ?, platform = ?,
        compatibility_json = ?, formats_json = ?, textures_included = ?,
        license_type = ?, license_json = ?, image_url = ?, video_url = ?,
        shopify_product_id = ?, shopify_variant_id = ?, is_featured = ?,
        is_bestseller = ?, is_new = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      title,
      description,
      priceUsd,
      compareAtUsd,
      isPack ? 1 : 0,
      modelCount,
      polyCount,
      categorySlug,
      platform,
      JSON.stringify(compatibility),
      JSON.stringify(formats),
      texturesIncluded ? 1 : 0,
      licenseType,
      JSON.stringify(license),
      imageUrl,
      videoUrl,
      shopifyProductId,
      shopifyVariantId,
      isFeatured ? 1 : 0,
      isBestseller ? 1 : 0,
      isNew ? 1 : 0,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(mapProductRow(updated, true));
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '');
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    const assetDir = path.resolve(STORAGE_ROOT, id);
    if (assetDir.startsWith(STORAGE_ROOT + path.sep) && fs.existsSync(assetDir)) {
      fs.rmSync(assetDir, { recursive: true, force: true });
    }
    res.json({ ok: true });
  });

  // Upload or update 3D asset file (supports real binary files up to 25MB base64)
  app.post('/api/admin/products/:id/files', requireAdmin, (req, res) => {
    const productId = String(req.params.id || '');
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const rawName = String(req.body?.fileName || '').trim();
    const format = String(req.body?.format || '').trim().toUpperCase() as AssetFormat;
    const version = String(req.body?.version || '1.0').trim().slice(0, 20);
    const contentBase64 = String(req.body?.contentBase64 || '');

    if (!rawName || !ALLOWED_FORMATS.includes(format) || !contentBase64) {
      res.status(400).json({ error: 'File name, supported 3D format, and file content are required.' });
      return;
    }

    const sanitizedName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.resolve(STORAGE_ROOT, productId);
    if (!dir.startsWith(STORAGE_ROOT + path.sep)) {
      res.status(400).json({ error: 'Invalid storage directory.' });
      return;
    }
    fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.from(contentBase64, 'base64');
    if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
      res.status(400).json({ error: 'File size must be between 1 byte and 25 MB.' });
      return;
    }

    const targetPath = path.resolve(dir, `${Date.now()}_${sanitizedName}`);
    if (!targetPath.startsWith(dir + path.sep)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }
    fs.writeFileSync(targetPath, buffer);

    const fileId = crypto.randomUUID();
    const relPath = path.relative(STORAGE_ROOT, targetPath);
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO product_files (id, product_id, file_name, format, file_size_bytes, version, storage_rel_path, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(fileId, productId, sanitizedName, format, buffer.length, version, relPath, now);

    // Automatically unlock updated file for existing paid buyers of this product
    const paidOrders = db
      .prepare(
        `SELECT o.id as order_id, o.user_id FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE oi.product_id = ? AND o.status = 'paid' AND o.user_id IS NOT NULL`
      )
      .all(productId) as Array<{ order_id: string; user_id: string }>;

    for (const ord of paidOrders) {
      issueDownloadTokensForOrder(ord.order_id, ord.user_id);
    }

    res.status(201).json({
      id: fileId,
      productId,
      fileName: sanitizedName,
      format,
      fileSizeBytes: buffer.length,
      version,
      uploadedAt: now,
    });
  });

  app.delete('/api/admin/files/:fileId', requireAdmin, (req, res) => {
    const fileId = String(req.params.fileId || '');
    const row = db.prepare('SELECT storage_rel_path FROM product_files WHERE id = ?').get(fileId) as
      | { storage_rel_path: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    const targetPath = path.resolve(STORAGE_ROOT, row.storage_rel_path);
    if (targetPath.startsWith(STORAGE_ROOT + path.sep) && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    db.prepare('DELETE FROM product_files WHERE id = ?').run(fileId);
    res.json({ ok: true });
  });

  // Categories CRUD
  app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const platform = ALLOWED_PLATFORMS.includes(req.body?.platform) ? req.body.platform : 'Roblox Studio';
    const description = String(req.body?.description || '').trim().slice(0, 300);
    if (!name) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const slug = slugify(name) || id;
    const countRow = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
    db.prepare('INSERT INTO categories (id, slug, name, platform, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      slug,
      name,
      platform,
      description,
      countRow.count + 1
    );
    res.status(201).json({ id, slug, name, platform, description, sortOrder: countRow.count + 1, productCount: 0 });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '');
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // Coupons CRUD
  app.get('/api/admin/coupons', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
    res.json(
      rows.map((c) => ({
        id: String(c.id),
        code: String(c.code),
        discountPercent: Number(c.discount_percent),
        active: Boolean(c.active),
        usesCount: Number(c.uses_count),
        maxUses: c.max_uses !== null ? Number(c.max_uses) : null,
        expiresAt: c.expires_at ? String(c.expires_at) : null,
        createdAt: String(c.created_at),
      }))
    );
  });

  app.post('/api/admin/coupons', requireAdmin, (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const discountPercent = Math.min(90, Math.max(1, Number(req.body?.discountPercent || 10)));
    const maxUses = req.body?.maxUses ? Number(req.body.maxUses) : null;

    if (!code || code.length < 3) {
      res.status(400).json({ error: 'Coupon code must be at least 3 alphanumeric characters.' });
      return;
    }

    const id = `coupon-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    try {
      db.prepare(
        'INSERT INTO coupons (id, code, discount_percent, active, uses_count, max_uses, expires_at, created_at) VALUES (?, ?, ?, 1, 0, ?, NULL, ?)'
      ).run(id, code, discountPercent, maxUses, now);
      res.status(201).json({
        id,
        code,
        discountPercent,
        active: true,
        usesCount: 0,
        maxUses,
        expiresAt: null,
        createdAt: now,
      });
    } catch {
      res.status(409).json({ error: 'A coupon with that code already exists.' });
    }
  });

  app.patch('/api/admin/coupons/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '');
    const active = req.body?.active ? 1 : 0;
    db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active, id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(String(req.params.id || ''));
    res.json({ ok: true });
  });

  // Orders Management
  app.get('/api/admin/orders', requireAdmin, (_req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all() as Array<
      Record<string, unknown>
    >;
    res.json(
      orders.map((o) => {
        const items = db
          .prepare('SELECT * FROM order_items WHERE order_id = ?')
          .all(String(o.id)) as Array<Record<string, unknown>>;
        return {
          id: String(o.id),
          orderNumber: String(o.order_number),
          userId: o.user_id ? String(o.user_id) : null,
          customerEmail: String(o.customer_email),
          shopifyOrderId: o.shopify_order_id ? String(o.shopify_order_id) : null,
          shopifyCheckoutUrl: o.shopify_checkout_url ? String(o.shopify_checkout_url) : null,
          status: String(o.status),
          subtotalUsd: Number(o.subtotal_usd),
          discountUsd: Number(o.discount_usd),
          totalUsd: Number(o.total_usd),
          couponCode: o.coupon_code ? String(o.coupon_code) : null,
          paymentProvider: String(o.payment_provider),
          createdAt: String(o.created_at),
          items: items.map((i) => ({
            id: String(i.id),
            orderId: String(i.order_id),
            productId: String(i.product_id),
            title: String(i.title),
            priceUsd: Number(i.price_usd),
            isPack: Boolean(i.is_pack),
          })),
        };
      })
    );
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    const orderId = String(req.params.id || '');
    const status = String(req.body?.status || '');
    if (!['pending', 'paid', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const wasPaid = String(order.status) === 'paid';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);

    if (status === 'paid' && !wasPaid) {
      const items = db
        .prepare('SELECT product_id FROM order_items WHERE order_id = ?')
        .all(orderId) as Array<{ product_id: string }>;
      for (const item of items) {
        db.prepare('UPDATE products SET sales_count = sales_count + 1 WHERE id = ?').run(item.product_id);
      }
      if (order.user_id) {
        issueDownloadTokensForOrder(orderId, String(order.user_id));
      }
    }

    res.json({ ok: true, status });
  });

  // Support Tickets Admin
  app.get('/api/admin/tickets', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all() as Array<
      Record<string, unknown>
    >;
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        customerEmail: String(r.customer_email),
        orderNumber: r.order_number ? String(r.order_number) : null,
        subject: String(r.subject),
        message: String(r.message),
        status: String(r.status),
        createdAt: String(r.created_at),
      }))
    );
  });

  app.patch('/api/admin/tickets/:id', requireAdmin, (req, res) => {
    const status = req.body?.status === 'resolved' ? 'resolved' : 'open';
    db.prepare('UPDATE support_tickets SET status = ? WHERE id = ?').run(status, String(req.params.id || ''));
    res.json({ ok: true });
  });

  // Shopify Catalog Sync
  app.post('/api/admin/shopify/sync', requireAdmin, async (_req, res) => {
    const rows = db.prepare('SELECT * FROM products').all() as Array<Record<string, unknown>>;
    const products = rows.map((r) => mapProductRow(r, false));
    const synced: Array<{ id: string; title: string; shopifyProductId: string; shopifyVariantId: string }> = [];

    try {
      for (const p of products) {
        const result = await syncProductToShopifyAdmin(p);
        db.prepare('UPDATE products SET shopify_product_id = ?, shopify_variant_id = ?, updated_at = ? WHERE id = ?').run(
          result.shopifyProductId,
          result.shopifyVariantId,
          new Date().toISOString(),
          p.id
        );
        synced.push({ id: p.id, title: p.title, ...result });
      }
      res.json({ syncedCount: synced.length, synced });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Shopify sync failed.' });
    }
  });

  // Vite dev middleware or static dist serving
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fox Boy's 3D Assets running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
