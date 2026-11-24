import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import type {
  AssetFormat,
  Category,
  LicenseTerms,
  PlatformCategory,
  Product,
  ProductFile,
  ThreePreset,
} from '../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'assets');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(STORAGE_ROOT, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'foxboy.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    country TEXT NOT NULL DEFAULT 'United States',
    studio_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_usd REAL NOT NULL,
    compare_at_usd REAL,
    is_pack INTEGER NOT NULL DEFAULT 0,
    model_count INTEGER NOT NULL DEFAULT 1,
    poly_count TEXT NOT NULL DEFAULT '2,500 tris',
    category_slug TEXT NOT NULL,
    platform TEXT NOT NULL,
    compatibility_json TEXT NOT NULL,
    formats_json TEXT NOT NULL,
    textures_included INTEGER NOT NULL DEFAULT 1,
    license_type TEXT NOT NULL DEFAULT 'Standard Commercial & Game License',
    license_json TEXT NOT NULL,
    image_url TEXT NOT NULL,
    video_url TEXT,
    three_preset TEXT NOT NULL DEFAULT 'sports_car',
    shopify_product_id TEXT,
    shopify_variant_id TEXT,
    sales_count INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_bestseller INTEGER NOT NULL DEFAULT 0,
    is_new INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_files (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    format TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    storage_rel_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    uses_count INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    expires_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    user_id TEXT,
    customer_email TEXT NOT NULL,
    shopify_order_id TEXT,
    shopify_checkout_id TEXT,
    shopify_checkout_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal_usd REAL NOT NULL,
    discount_usd REAL NOT NULL DEFAULT 0,
    total_usd REAL NOT NULL,
    coupon_code TEXT,
    payment_provider TEXT NOT NULL DEFAULT 'shopify',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd REAL NOT NULL,
    is_pack INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS download_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES product_files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    order_number TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function generateSampleObj(title: string, preset: ThreePreset): string {
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  return [
    `# Fox Boy's 3D Assets — Clean Game-Ready Mesh`,
    `# Asset: ${title} (${preset})`,
    `# Format: Wavefront OBJ (Meters, Y-Up, Triangulated)`,
    `o ${safeName}`,
    `v -1.0 0.0 -1.0`,
    `v 1.0 0.0 -1.0`,
    `v 1.0 0.0 1.0`,
    `v -1.0 0.0 1.0`,
    `v -0.8 1.2 -0.8`,
    `v 0.8 1.2 -0.8`,
    `v 0.8 1.2 0.8`,
    `v -0.8 1.2 0.8`,
    `vt 0.0 0.0`,
    `vt 1.0 0.0`,
    `vt 1.0 1.0`,
    `vt 0.0 1.0`,
    `vn 0.0 1.0 0.0`,
    `vn 0.0 0.0 1.0`,
    `vn 1.0 0.0 0.0`,
    `f 1/1/1 2/2/1 3/3/1 4/4/1`,
    `f 5/1/1 6/2/1 7/3/1 8/4/1`,
    `f 1/1/2 2/2/2 6/3/2 5/4/2`,
    `f 2/1/3 3/2/3 7/3/3 6/4/3`,
    `f 3/1/2 4/2/2 8/3/2 7/4/2`,
    `f 4/1/3 1/2/3 5/3/3 8/4/3`,
  ].join('\n');
}

function generateSampleRbxmx(title: string): string {
  const escaped = title.replace(/[<>&"']/g, '');
  return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="Model" referent="RBX0">
    <Properties>
      <string name="Name">${escaped}</string>
    </Properties>
    <Item class="Part" referent="RBX1">
      <Properties>
        <string name="Name">PrimaryRoot</string>
        <bool name="Anchored">true</bool>
        <Vector3 name="size">
          <X>4</X>
          <Y>2</Y>
          <Z>4</Z>
        </Vector3>
        <Color3uint8 name="Color3uint8">4290359528</Color3uint8>
      </Properties>
    </Item>
  </Item>
</roblox>`;
}

export async function createPackBundleFiles(
  productId: string,
  slug: string,
  title: string,
  preset: ThreePreset,
  formats: AssetFormat[],
  licenseSummary: string
): Promise<Array<{ id: string; fileName: string; format: AssetFormat; size: number; relPath: string }>> {
  const dir = path.join(STORAGE_ROOT, productId);
  fs.mkdirSync(dir, { recursive: true });
  const results: Array<{ id: string; fileName: string; format: AssetFormat; size: number; relPath: string }> = [];

  const objContent = generateSampleObj(title, preset);
  const rbxmxContent = generateSampleRbxmx(title);
  const licenseTxt = `FOX BOY'S 3D ASSETS — OFFICIAL LICENSE\nProduct: ${title}\n\n${licenseSummary}\n\nSupport: support@foxboys3d.com\n`;

  if (formats.includes('.OBJ')) {
    const fileName = `${slug}.obj`;
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, objContent, 'utf8');
    results.push({
      id: crypto.randomUUID(),
      fileName,
      format: '.OBJ',
      size: Buffer.byteLength(objContent, 'utf8'),
      relPath: path.join(productId, fileName),
    });
  }

  if (formats.includes('.RBXMX') || formats.includes('.RBXM')) {
    const fmt: AssetFormat = formats.includes('.RBXMX') ? '.RBXMX' : '.RBXM';
    const ext = fmt === '.RBXMX' ? 'rbxmx' : 'rbxm';
    const fileName = `${slug}.${ext}`;
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, rbxmxContent, 'utf8');
    results.push({
      id: crypto.randomUUID(),
      fileName,
      format: fmt,
      size: Buffer.byteLength(rbxmxContent, 'utf8'),
      relPath: path.join(productId, fileName),
    });
  }

  if (formats.includes('.ZIP') || results.length === 0) {
    const zip = new JSZip();
    zip.file(`${slug}.obj`, objContent);
    zip.file(`${slug}.rbxmx`, rbxmxContent);
    zip.file('LICENSE.txt', licenseTxt);
    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          brand: "Fox Boy's 3D Assets",
          title,
          formats,
          version: '1.0',
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const fileName = `${slug}-complete-pack.zip`;
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, buffer);
    results.push({
      id: crypto.randomUUID(),
      fileName,
      format: '.ZIP',
      size: buffer.length,
      relPath: path.join(productId, fileName),
    });
  }

  return results;
}

export async function seedInitialCatalogIfEmpty(): Promise<void> {
  const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (existingCategories.count === 0) {
    const seedCategories: Array<Omit<Category, 'productCount'>> = [
      // ROBLOX STUDIO
      { id: 'cat-rs-cars', slug: 'cars-vehicles', name: 'Cars & Vehicles', platform: 'Roblox Studio', description: 'Stylized low-poly sports cars, utility trucks, and drivable vehicle shells ready for Roblox Studio.', sortOrder: 1 },
      { id: 'cat-rs-houses', slug: 'houses-buildings', name: 'Houses & Buildings', platform: 'Roblox Studio', description: 'Modular residential cottages, storefronts, and interior-ready architectural shells.', sortOrder: 2 },
      { id: 'cat-rs-envs', slug: 'scenarios-environments', name: 'Environments', platform: 'Roblox Studio', description: 'Complete city blocks, biome kits, roads, and stylized nature environments.', sortOrder: 3 },
      { id: 'cat-rs-furniture', slug: 'furniture-decor', name: 'Furniture & Decor', platform: 'Roblox Studio', description: 'Cozy room interiors, gaming setups, shelving, lighting, and decor props.', sortOrder: 4 },
      { id: 'cat-rs-chars', slug: 'characters', name: 'Characters', platform: 'Roblox Studio', description: 'Rigged stylized NPCs and starter R15/R6 compatible character meshes.', sortOrder: 5 },
      { id: 'cat-rs-pets', slug: 'pets-animals', name: 'Pets & Animals', platform: 'Roblox Studio', description: 'Low-poly companion pets and simulator-ready animal models.', sortOrder: 6 },
      { id: 'cat-rs-objects', slug: 'objects-items', name: 'Objects & Items', platform: 'Roblox Studio', description: 'Gameplay pickups, crates, tools, and interactive world items.', sortOrder: 7 },
      { id: 'cat-rs-lowpoly', slug: 'low-poly-models', name: 'Low-Poly Models', platform: 'Roblox Studio', description: 'Performance-tuned low-poly meshes optimized for mobile and console Roblox titles.', sortOrder: 8 },
      { id: 'cat-rs-packs', slug: 'asset-packs', name: 'Asset Packs', platform: 'Roblox Studio', description: 'Multi-model studio bundles priced for indie Roblox teams.', sortOrder: 9 },
      { id: 'cat-rs-anims', slug: 'animations', name: 'Animations', platform: 'Roblox Studio', description: 'Clean character locomotion and emote animation rigs.', sortOrder: 10 },
      // ROBLOX UGC
      { id: 'cat-ugc-hats', slug: 'ugc-hats', name: 'Hats', platform: 'Roblox UGC', description: 'Beanies, caps, and stylized headwear sized for Roblox avatar heads.', sortOrder: 11 },
      { id: 'cat-ugc-hair', slug: 'ugc-hair', name: 'Hair', platform: 'Roblox UGC', description: 'Layered stylized hair meshes with clean UV layouts.', sortOrder: 12 },
      { id: 'cat-ugc-acc', slug: 'ugc-accessories', name: 'Accessories', platform: 'Roblox UGC', description: 'Backpacks, headphones, scarves, and wearable avatar accessories.', sortOrder: 13 },
      { id: 'cat-ugc-head', slug: 'ugc-head-items', name: 'Head Items', platform: 'Roblox UGC', description: 'Ears, horns, crowns, and top-of-head UGC attachments.', sortOrder: 14 },
      { id: 'cat-ugc-face', slug: 'ugc-face-accessories', name: 'Face Accessories', platform: 'Roblox UGC', description: 'Round glasses, cyber visors, and stylized face wearables.', sortOrder: 15 },
      { id: 'cat-ugc-collections', slug: 'ugc-collections', name: 'UGC Collections', platform: 'Roblox UGC', description: 'Curated multi-piece UGC wearable packs.', sortOrder: 16 },
      // GAME DEVELOPMENT
      { id: 'cat-gd-models', slug: 'game-3d-models', name: '3D Game Models', platform: 'Game Development', description: 'Clean FBX/OBJ/BLEND assets ready for Unity, Unreal Engine, and Godot.', sortOrder: 17 },
      { id: 'cat-gd-props', slug: 'props-objects', name: 'Props & Objects', platform: 'Game Development', description: 'Modular crates, barrels, foliage, and level-dressing props.', sortOrder: 18 },
      { id: 'cat-gd-envs', slug: 'game-environments', name: 'Game Environments', platform: 'Game Development', description: 'Modular terrain tiles, streets, and architectural kits.', sortOrder: 19 },
      { id: 'cat-gd-packs', slug: 'game-dev-packs', name: 'Game Dev Packs', platform: 'Game Development', description: 'Complete genre starter packs for indie game studios.', sortOrder: 20 },
    ];

    const insertCat = db.prepare(
      'INSERT INTO categories (id, slug, name, platform, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const c of seedCategories) {
      insertCat.run(c.id, c.slug, c.name, c.platform, c.description, c.sortOrder);
    }
  }

  const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (existingProducts.count === 0) {
    const now = new Date().toISOString();
    const defaultLicense: LicenseTerms = {
      personalUse: true,
      commercialUse: true,
      inGameUse: true,
      noRedistribution: true,
      noResaleOriginal: true,
      specialNotes: 'Includes lifetime updates and multi-project commercial game deployment.',
    };

    const seedProducts: Array<{
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
      platform: PlatformCategory;
      compatibility: string[];
      formats: AssetFormat[];
      imageUrl: string;
      threePreset: ThreePreset;
      salesCount: number;
      isFeatured: boolean;
      isBestseller: boolean;
      isNew: boolean;
    }> = [
      {
        id: 'prod-sports-car-pack',
        slug: 'sports-car-pack',
        title: 'Sports Car Pack',
        description:
          '5 stylized low-poly sports cars engineered for Roblox Studio racing games and indie arcade titles. Separated wheel pivots, clean interior glass, PBR color palettes, and organized folder hierarchy.',
        priceUsd: 12.0,
        compareAtUsd: 18.0,
        isPack: true,
        modelCount: 5,
        polyCount: '14,200 tris total (~2.8k/car)',
        categorySlug: 'cars-vehicles',
        platform: 'Roblox Studio',
        compatibility: ['Roblox Studio', 'Blender 4.x', 'Unity', 'Unreal Engine'],
        formats: ['.BLEND', '.FBX', '.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_sports_cars_1795533988684.jpg',
        threePreset: 'sports_car',
        salesCount: 142,
        isFeatured: true,
        isBestseller: true,
        isNew: false,
      },
      {
        id: 'prod-lowpoly-house-pack',
        slug: 'low-poly-house-pack',
        title: 'Low Poly House Pack',
        description:
          'Cozy low-poly neighborhood pack featuring 6 distinct cottages, modular wooden fences, stylized trees, stone wells, and garden decor props with clean UV-mapped textures.',
        priceUsd: 10.0,
        compareAtUsd: 15.0,
        isPack: true,
        modelCount: 6,
        polyCount: '9,800 tris total',
        categorySlug: 'houses-buildings',
        platform: 'Roblox Studio',
        compatibility: ['Roblox Studio', 'Blender 4.x', 'Unity', 'Godot'],
        formats: ['.FBX', '.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_lowpoly_houses_1795533989145.jpg',
        threePreset: 'lowpoly_house',
        salesCount: 118,
        isFeatured: true,
        isBestseller: true,
        isNew: false,
      },
      {
        id: 'prod-roblox-city-pack',
        slug: 'roblox-city-assets-pack',
        title: 'Roblox City Assets Pack',
        description:
          '24 modular urban buildings, crosswalk road tiles, streetlamps, traffic signals, bus shelters, benches, and hydrants ready for roleplay and open-world city maps.',
        priceUsd: 15.0,
        compareAtUsd: 24.0,
        isPack: true,
        modelCount: 24,
        polyCount: '32,000 tris total',
        categorySlug: 'scenarios-environments',
        platform: 'Roblox Studio',
        compatibility: ['Roblox Studio', 'Blender 4.x', 'Unity', 'Unreal Engine'],
        formats: ['.BLEND', '.FBX', '.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_roblox_city_1795533990083.jpg',
        threePreset: 'city_block',
        salesCount: 96,
        isFeatured: true,
        isBestseller: true,
        isNew: true,
      },
      {
        id: 'prod-ugc-accessories-pack',
        slug: 'ugc-accessories-pack',
        title: 'UGC Accessories Pack',
        description:
          '4 avatar-ready Roblox UGC items including signature Fox-Ear Gaming Headphones, Round Wire Glasses, Mini Canvas Backpack, and Ribbed Knit Beanie. Includes clean UV textures and Roblox triangle-budget compliance.',
        priceUsd: 8.0,
        compareAtUsd: 12.0,
        isPack: true,
        modelCount: 4,
        polyCount: '4,600 tris total (<= 1.2k/item)',
        categorySlug: 'ugc-collections',
        platform: 'Roblox UGC',
        compatibility: ['Roblox UGC', 'Roblox Studio', 'Blender 4.x'],
        formats: ['.FBX', '.OBJ', '.RBXM', '.ZIP'],
        imageUrl: '/src/assets/images/pack_ugc_accessories_1795533990409.jpg',
        threePreset: 'ugc_headphones',
        salesCount: 87,
        isFeatured: true,
        isBestseller: false,
        isNew: true,
      },
      {
        id: 'prod-furniture-pack',
        slug: 'furniture-pack',
        title: 'Modern Furniture Pack',
        description:
          '10 stylized interior props including an RGB gaming desk, ergonomic chair, sofa, bookcase, monstera plant, and neon desk lamp for tycoon, apartment, and hangout experiences.',
        priceUsd: 9.0,
        compareAtUsd: 14.0,
        isPack: true,
        modelCount: 10,
        polyCount: '7,400 tris total',
        categorySlug: 'furniture-decor',
        platform: 'Roblox Studio',
        compatibility: ['Roblox Studio', 'Blender 4.x', 'Unity', 'Godot'],
        formats: ['.FBX', '.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_furniture_starter_1795533991411.jpg',
        threePreset: 'furniture',
        salesCount: 74,
        isFeatured: false,
        isBestseller: true,
        isNew: false,
      },
      {
        id: 'prod-fox-glasses-ugc',
        slug: 'fox-boy-round-glasses-ugc',
        title: 'Fox Boy Signature Glasses (UGC)',
        description:
          'Iconic round metal-frame glasses inspired by Senhor Raposa. Lightweight topology under 1,100 triangles with subtle optical lens tint ready for Roblox UGC upload.',
        priceUsd: 3.0,
        compareAtUsd: null,
        isPack: false,
        modelCount: 1,
        polyCount: '1,080 tris',
        categorySlug: 'ugc-face-accessories',
        platform: 'Roblox UGC',
        compatibility: ['Roblox UGC', 'Roblox Studio', 'Blender 4.x'],
        formats: ['.FBX', '.OBJ', '.RBXM', '.ZIP'],
        imageUrl: '/src/assets/images/pack_ugc_accessories_1795533990409.jpg',
        threePreset: 'glasses',
        salesCount: 64,
        isFeatured: false,
        isBestseller: false,
        isNew: true,
      },
      {
        id: 'prod-complete-vehicle-pack',
        slug: 'complete-vehicle-pack',
        title: 'Complete Vehicle Mega Pack',
        description:
          '12 stylized game-ready vehicles spanning sports coupes, city taxis, delivery vans, and pickup trucks. Built for large-scale open-world games on Roblox, Unity, and Unreal.',
        priceUsd: 22.0,
        compareAtUsd: 32.0,
        isPack: true,
        modelCount: 12,
        polyCount: '28,500 tris total',
        categorySlug: 'game-dev-packs',
        platform: 'Game Development',
        compatibility: ['Roblox Studio', 'Unity', 'Unreal Engine', 'Godot', 'Blender 4.x'],
        formats: ['.BLEND', '.FBX', '.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_sports_cars_1795533988684.jpg',
        threePreset: 'sports_car',
        salesCount: 51,
        isFeatured: false,
        isBestseller: false,
        isNew: true,
      },
      {
        id: 'prod-starter-crate-kit',
        slug: 'starter-crate-barrel-kit',
        title: 'Starter Crate & Barrel Kit (Free Sample)',
        description:
          'Complimentary 3-piece stylized prop kit (Reinforced Crate, Banded Barrel, Supply Chest) so developers can inspect Fox Boy topology, pivot alignment, and instant digital delivery before buying full packs.',
        priceUsd: 0.0,
        compareAtUsd: null,
        isPack: true,
        modelCount: 3,
        polyCount: '680 tris total',
        categorySlug: 'props-objects',
        platform: 'Game Development',
        compatibility: ['Roblox Studio', 'Unity', 'Unreal Engine', 'Godot', 'Blender 4.x'],
        formats: ['.OBJ', '.RBXMX', '.ZIP'],
        imageUrl: '/src/assets/images/pack_roblox_city_1795533990083.jpg',
        threePreset: 'crates',
        salesCount: 215,
        isFeatured: true,
        isBestseller: false,
        isNew: false,
      },
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (
        id, slug, title, description, price_usd, compare_at_usd, is_pack, model_count,
        poly_count, category_slug, platform, compatibility_json, formats_json, textures_included,
        license_type, license_json, image_url, video_url, three_preset, sales_count,
        is_featured, is_bestseller, is_new, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFile = db.prepare(`
      INSERT INTO product_files (id, product_id, file_name, format, file_size_bytes, version, storage_rel_path, uploaded_at)
      VALUES (?, ?, ?, ?, ?, '1.0', ?, ?)
    `);

    for (const p of seedProducts) {
      insertProd.run(
        p.id,
        p.slug,
        p.title,
        p.description,
        p.priceUsd,
        p.compareAtUsd,
        p.isPack ? 1 : 0,
        p.modelCount,
        p.polyCount,
        p.categorySlug,
        p.platform,
        JSON.stringify(p.compatibility),
        JSON.stringify(p.formats),
        'Standard Commercial & Game License',
        JSON.stringify(defaultLicense),
        p.imageUrl,
        p.threePreset,
        p.salesCount,
        p.isFeatured ? 1 : 0,
        p.isBestseller ? 1 : 0,
        p.isNew ? 1 : 0,
        now,
        now
      );

      const files = await createPackBundleFiles(
        p.id,
        p.slug,
        p.title,
        p.threePreset,
        p.formats,
        defaultLicense.specialNotes
      );
      for (const f of files) {
        insertFile.run(f.id, p.id, f.fileName, f.format, f.size, f.relPath, now);
      }
    }

    // Seed one welcome coupon
    db.prepare(
      'INSERT OR IGNORE INTO coupons (id, code, discount_percent, active, uses_count, max_uses, expires_at, created_at) VALUES (?, ?, ?, 1, 0, 500, NULL, ?)'
    ).run('coupon-fox20', 'FOX20', 20, now);
  }
}

export function mapProductRow(row: Record<string, unknown>, includeFiles = false): Product {
  const id = String(row.id);
  const files: ProductFile[] | undefined = includeFiles
    ? (db
        .prepare('SELECT id, product_id, file_name, format, file_size_bytes, version, uploaded_at FROM product_files WHERE product_id = ? ORDER BY uploaded_at DESC')
        .all(id) as Array<Record<string, unknown>>
      ).map((f) => ({
        id: String(f.id),
        productId: String(f.product_id),
        fileName: String(f.file_name),
        format: String(f.format) as AssetFormat,
        fileSizeBytes: Number(f.file_size_bytes),
        version: String(f.version),
        uploadedAt: String(f.uploaded_at),
      }))
    : undefined;

  return {
    id,
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    priceUsd: Number(row.price_usd),
    compareAtUsd: row.compare_at_usd !== null && row.compare_at_usd !== undefined ? Number(row.compare_at_usd) : null,
    isPack: Boolean(row.is_pack),
    modelCount: Number(row.model_count),
    polyCount: String(row.poly_count),
    categorySlug: String(row.category_slug),
    categoryName: row.category_name ? String(row.category_name) : undefined,
    platform: String(row.platform) as PlatformCategory,
    compatibility: JSON.parse(String(row.compatibility_json || '[]')),
    formats: JSON.parse(String(row.formats_json || '[]')),
    texturesIncluded: Boolean(row.textures_included),
    licenseType: String(row.license_type),
    license: JSON.parse(String(row.license_json || '{}')),
    imageUrl: String(row.image_url),
    videoUrl: row.video_url ? String(row.video_url) : null,
    threePreset: String(row.three_preset) as ThreePreset,
    shopifyProductId: row.shopify_product_id ? String(row.shopify_product_id) : null,
    shopifyVariantId: row.shopify_variant_id ? String(row.shopify_variant_id) : null,
    salesCount: Number(row.sales_count),
    isFeatured: Boolean(row.is_featured),
    isBestseller: Boolean(row.is_bestseller),
    isNew: Boolean(row.is_new),
    files,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
