import crypto from 'crypto';
import type { Product, ShopifyStatus } from '../src/types.ts';

function normalizeShopifyDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  // Strict hostname allowlist check to prevent SSRF to internal hosts
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(cleaned)) {
    return null;
  }
  if (
    cleaned === 'localhost' ||
    cleaned.startsWith('127.') ||
    cleaned.startsWith('10.') ||
    cleaned.startsWith('192.168.') ||
    cleaned.startsWith('169.254.')
  ) {
    return null;
  }
  return cleaned;
}

export function getShopifyConfig() {
  const storeDomain = normalizeShopifyDomain(process.env.SHOPIFY_STORE_DOMAIN);
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() || null;
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() || null;
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || null;

  return {
    storeDomain,
    storefrontToken,
    adminToken,
    webhookSecret,
  };
}

export function getPublicShopifyStatus(): ShopifyStatus {
  const cfg = getShopifyConfig();
  const configured = Boolean(cfg.storeDomain && cfg.storefrontToken);
  return {
    configured,
    storeDomainMasked: cfg.storeDomain ? cfg.storeDomain : null,
    adminSyncEnabled: Boolean(cfg.storeDomain && cfg.adminToken),
    webhookConfigured: Boolean(cfg.webhookSecret),
  };
}

export async function createShopifyCheckoutCart(params: {
  items: Array<{ product: Product; quantity: number }>;
  customerEmail: string;
  discountCode?: string | null;
}): Promise<{ checkoutUrl: string; cartId: string }> {
  const cfg = getShopifyConfig();
  if (!cfg.storeDomain || !cfg.storefrontToken) {
    throw new Error('SHOPIFY_NOT_CONFIGURED');
  }

  const missingVariants = params.items.filter((i) => !i.product.shopifyVariantId);
  if (missingVariants.length > 0) {
    throw new Error(
      `Missing Shopify Variant ID for: ${missingVariants
        .map((m) => m.product.title)
        .join(', ')}. Sync catalog to Shopify in the Admin Panel first.`
    );
  }

  const lines = params.items.map((i) => ({
    merchandiseId: i.product.shopifyVariantId!.startsWith('gid://')
      ? i.product.shopifyVariantId
      : `gid://shopify/ProductVariant/${i.product.shopifyVariantId}`,
    quantity: i.quantity,
  }));

  const mutation = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input: Record<string, unknown> = {
    lines,
    buyerIdentity: {
      email: params.customerEmail,
    },
  };
  if (params.discountCode) {
    input.discountCodes = [params.discountCode];
  }

  const endpoint = `https://${cfg.storeDomain}/api/2025-01/graphql.json`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': cfg.storefrontToken,
    },
    body: JSON.stringify({ query: mutation, variables: { input } }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shopify Storefront API error (${resp.status}): ${text.slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    data?: {
      cartCreate?: {
        cart?: { id: string; checkoutUrl: string } | null;
        userErrors?: Array<{ message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  const userErrors = json.data?.cartCreate?.userErrors || json.errors || [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join('; '));
  }

  const cart = json.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) {
    throw new Error('Shopify did not return a checkout URL.');
  }

  return { checkoutUrl: cart.checkoutUrl, cartId: cart.id };
}

export async function syncProductToShopifyAdmin(product: Product): Promise<{
  shopifyProductId: string;
  shopifyVariantId: string;
}> {
  const cfg = getShopifyConfig();
  if (!cfg.storeDomain || !cfg.adminToken) {
    throw new Error('Shopify Admin API credentials are not configured on the server.');
  }

  const baseUrl = `https://${cfg.storeDomain}/admin/api/2025-01`;
  const payload = {
    product: {
      title: product.title,
      body_html: `<p>${product.description}</p><p><strong>Formats:</strong> ${product.formats.join(', ')} | <strong>Models:</strong> ${product.modelCount}</p>`,
      vendor: "Fox Boy's 3D Assets",
      product_type: product.platform,
      status: 'active',
      variants: [
        {
          price: product.priceUsd.toFixed(2),
          compare_at_price: product.compareAtUsd ? product.compareAtUsd.toFixed(2) : null,
          requires_shipping: false,
          taxable: false,
          sku: product.slug.toUpperCase(),
        },
      ],
    },
  };

  const isUpdate = Boolean(product.shopifyProductId);
  const url = isUpdate
    ? `${baseUrl}/products/${encodeURIComponent(product.shopifyProductId!)}.json`
    : `${baseUrl}/products.json`;

  const resp = await fetch(url, {
    method: isUpdate ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': cfg.adminToken,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Shopify Admin API error (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await resp.json()) as {
    product: { id: number | string; variants: Array<{ id: number | string }> };
  };

  return {
    shopifyProductId: String(data.product.id),
    shopifyVariantId: String(data.product.variants[0]?.id || ''),
  };
}

export function verifyShopifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined): boolean {
  const cfg = getShopifyConfig();
  if (!cfg.webhookSecret || !hmacHeader) return false;
  const computed = crypto
    .createHmac('sha256', cfg.webhookSecret)
    .update(rawBody)
    .digest('base64');
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(hmacHeader.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
