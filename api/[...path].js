const { Pool } = require('pg');
const crypto = require('node:crypto');
const { isAdminRequest } = require('../lib/admin-auth');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_DATABASE_URL;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 3,
});

function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

function requestPath(req) {
  const pathname = new URL(req.url || '/', 'https://vercel.local').pathname;
  const value = req.query?.path;
  if (pathname.startsWith('/api/') && pathname !== '/api/[...path]') return `/${pathname.slice('/api/'.length)}`;
  if (pathname === '/api' || pathname === '/' || pathname === '/api/[...path]') {
    if (Array.isArray(value)) return `/${value.join('/')}`;
    if (typeof value === 'string' && value) return `/${value.replace(/^\/+/, '')}`;
  }
  if (Array.isArray(value)) return `/${value.join('/')}`;
  if (typeof value === 'string' && value) return `/${value.replace(/^\/+/, '')}`;
  return pathname;
}

function queryValue(req, key) {
  const fromQuery = req.query?.[key];
  if (fromQuery !== undefined) return Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  return new URL(req.url || '/', 'https://vercel.local').searchParams.get(key);
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 100_000) reject(Object.assign(new Error('Yêu cầu quá lớn.'), { status: 413 }));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(Object.assign(new Error('Nội dung JSON không hợp lệ.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function isUploadThingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname.endsWith('.ufs.sh') || url.hostname === 'utfs.io');
  } catch { return false; }
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, price DOUBLE PRECISION NOT NULL,
      area DOUBLE PRECISION NOT NULL, type TEXT NOT NULL, district TEXT NOT NULL,
      ward TEXT NOT NULL DEFAULT '', street TEXT NOT NULL, province TEXT NOT NULL,
      image TEXT NOT NULL, gallery JSONB NOT NULL DEFAULT '[]', badge TEXT NOT NULL DEFAULT 'Mới đăng',
      amenities JSONB NOT NULL DEFAULT '[]', lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
      description TEXT NOT NULL, phone TEXT NOT NULL, deposit_amount DOUBLE PRECISION,
      video TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS saved_listings (
      visitor_id TEXT NOT NULL, listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(visitor_id, listing_id)
    );
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
      lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    INSERT INTO schools (id, name, address, lat, lng) VALUES
      ('ctu', 'Đại học Cần Thơ', 'Khu II, Đường 3/2, Ninh Kiều, Cần Thơ', 10.0299337, 105.7706153),
      ('ctump', 'Đại học Y Dược Cần Thơ', '179 Nguyễn Văn Cừ, Cần Thơ', 10.03462, 105.75541),
      ('nctu', 'Đại học Nam Cần Thơ', '168 Nguyễn Văn Cừ nối dài, Cần Thơ', 10.0070868, 105.7226855),
      ('tdu', 'Đại học Tây Đô', '68 Trần Chiên, Cái Răng, Cần Thơ', 9.99968, 105.76032)
    ON CONFLICT (id) DO NOTHING
  `);
}

function format(row, saved = false) {
  if (!row) return row;
  const images = [row.image, ...(row.gallery || [])];
  // Offset public pins slightly to avoid exposing an exact rental address.
  const angle = Number(row.id) * 137.508 * Math.PI / 180;
  const distance = 180 + (Number(row.id) * 47 % 90);
  return {
    ...row,
    image: images[0], gallery: images.slice(1), images, video: row.video || null,
    lat: row.lat + Math.sin(angle) * distance / 111320,
    lng: row.lng + Math.cos(angle) * distance / (111320 * Math.max(.2, Math.cos(row.lat * Math.PI / 180))),
    approximate: true, saved, amenities: row.amenities || [],
  };
}

function distanceSql() {
  return `6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(l.lat - $2) / 2), 2) +
    COS(RADIANS($2)) * COS(RADIANS(l.lat)) * POWER(SIN(RADIANS(l.lng - $3) / 2), 2)
  ))`;
}

module.exports = async (req, res) => {
  try {
    const path = requestPath(req);
    const visitor = String(req.headers['x-visitor-id'] || 'guest').slice(0, 80);

    if (path === '/config' && req.method === 'GET') {
      return json(res, 200, {
        cartoApiKey: process.env.CARTO_API_KEY || '',
        socialContacts: {
          zalo: process.env.ADMIN_ZALO_URL || '',
          facebook: process.env.ADMIN_FACEBOOK_URL || '',
          tiktok: process.env.ADMIN_TIKTOK_URL || '',
        },
      });
    }
    if (!databaseUrl) return json(res, 500, { error: 'Thiếu POSTGRES_DATABASE_URL trong Environment Variables của Vercel.' });
    if (path === '/admin/login' && (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET)) {
      return json(res, 500, { error: 'Thiếu ADMIN_PASSWORD hoặc SESSION_SECRET trong Environment Variables.' });
    }
    await init();

    if (path === '/schools' && req.method === 'GET') {
      const result = await pool.query('SELECT id, name, address, lat, lng FROM schools ORDER BY name');
      return json(res, 200, result.rows);
    }
    if (path === '/admin/status' && req.method === 'GET') {
      return json(res, 200, { authenticated: isAdminRequest(req) });
    }
    if (path === '/admin/login' && req.method === 'POST') {
      const input = await body(req);
      const actual = crypto.createHash('sha256').update(String(input.password || '')).digest();
      const expected = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
      if (!crypto.timingSafeEqual(actual, expected)) return json(res, 401, { error: 'Mật khẩu quản trị không đúng.' });
      const expires = String(Date.now() + 8 * 60 * 60 * 1000);
      const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(expires).digest('hex');
      return json(res, 200, { authenticated: true }, {
        'Set-Cookie': `odau_admin=${expires}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800; Secure`,
      });
    }
    if (path === '/admin/logout' && req.method === 'POST') {
      return json(res, 200, { authenticated: false }, {
        'Set-Cookie': 'odau_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure',
      });
    }
    if (path === '/listings' && req.method === 'GET') {
      const schoolId = queryValue(req, 'schoolId');
      const radius = Number(queryValue(req, 'schoolKm'));
      let result;
      if (schoolId && Number.isFinite(radius) && radius > 0) {
        const school = await pool.query('SELECT lat, lng FROM schools WHERE id = $1', [schoolId]);
        if (school.rowCount) {
          const { lat, lng } = school.rows[0];
          result = await pool.query(
            `SELECT l.*, EXISTS(SELECT 1 FROM saved_listings s WHERE s.listing_id=l.id AND s.visitor_id=$1) AS saved,
              ${distanceSql()} AS distance_km
             FROM listings l WHERE ${distanceSql()} <= $4 ORDER BY l.created_at DESC, l.id DESC`,
            [visitor, lat, lng, Math.min(radius, 50)],
          );
        }
      }
      if (!result) {
        result = await pool.query(
          `SELECT l.*, EXISTS(SELECT 1 FROM saved_listings s WHERE s.listing_id=l.id AND s.visitor_id=$1) AS saved
           FROM listings l ORDER BY l.created_at DESC, l.id DESC`, [visitor],
        );
      }
      return json(res, 200, result.rows.map(row => format(row, row.saved)));
    }
    if (path === '/listings' && req.method === 'POST') {
      if (!isAdminRequest(req)) return json(res, 403, { error: 'Chỉ quản trị viên mới có thể tạo tin.' });
      if (!process.env.UPLOADTHING_TOKEN) return json(res, 500, { error: 'Thiếu UPLOADTHING_TOKEN; hãy cấu hình UploadThing trong Vercel.' });
      const input = await body(req);
      const images = input.images;
      if (!Array.isArray(images) || images.length < 1 || images.length > 8 || images.some(url => !isUploadThingUrl(url))) {
        return json(res, 400, { error: 'Cần tải ít nhất 1 ảnh hợp lệ lên UploadThing (tối đa 8 ảnh).' });
      }
      if (input.video && !isUploadThingUrl(input.video)) return json(res, 400, { error: 'Video phải được tải lên UploadThing.' });
      const values = [input.title, Number(input.price), Number(input.area), input.type, input.district,
        input.ward || '', input.street, input.province, images[0], JSON.stringify(images.slice(1)),
        JSON.stringify(input.amenities || []), Number(input.lat), Number(input.lng), input.description,
        input.phone, input.depositAmount || null, input.video || null];
      if (!values[0] || !Number.isFinite(values[1]) || values[1] <= 0 || !Number.isFinite(values[2]) || values[2] <= 0 || !values[3] || !values[4] || !values[6] || !values[7] || !values[13] || !values[14] || !Number.isFinite(values[11]) || !Number.isFinite(values[12])) {
        return json(res, 400, { error: 'Vui lòng nhập đủ thông tin tin đăng và chọn vị trí trên bản đồ.' });
      }
      const result = await pool.query(
        `INSERT INTO listings(title,price,area,type,district,ward,street,province,image,gallery,badge,amenities,lat,lng,description,phone,deposit_amount,video)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'Mới đăng',$11::jsonb,$12,$13,$14,$15,$16,$17) RETURNING *`, values,
      );
      return json(res, 201, format(result.rows[0]));
    }
    const detail = path.match(/^\/listings\/(\d+)$/);
    if (detail && req.method === 'GET') {
      const result = await pool.query(
        `SELECT l.*, EXISTS(SELECT 1 FROM saved_listings s WHERE s.listing_id=l.id AND s.visitor_id=$2) AS saved
         FROM listings l WHERE l.id=$1`, [detail[1], visitor],
      );
      return result.rowCount ? json(res, 200, format(result.rows[0], result.rows[0].saved)) : json(res, 404, { error: 'Không tìm thấy tin đăng.' });
    }
    const saved = path.match(/^\/saved\/(\d+)$/);
    if (saved && req.method === 'POST') {
      const result = await pool.query('INSERT INTO saved_listings(visitor_id,listing_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [visitor, saved[1]]);
      return json(res, 200, { saved: true });
    }
    if (saved && req.method === 'DELETE') {
      await pool.query('DELETE FROM saved_listings WHERE visitor_id=$1 AND listing_id=$2', [visitor, saved[1]]);
      return json(res, 200, { saved: false });
    }
    if (path === '/saved' && req.method === 'GET') {
      const result = await pool.query(
        `SELECT l.*, true AS saved FROM listings l JOIN saved_listings s ON s.listing_id=l.id
         WHERE s.visitor_id=$1 ORDER BY s.created_at DESC`, [visitor],
      );
      return json(res, 200, result.rows.map(row => format(row, true)));
    }
    return json(res, 404, { error: `Không tìm thấy API ${req.method} ${path}.` });
  } catch (error) {
    console.error('API request failed:', error);
    return json(res, error.status || 500, { error: error.message || 'Lỗi máy chủ.' });
  }
};
