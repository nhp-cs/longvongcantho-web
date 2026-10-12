const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD before starting in production.');
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
const adminSessions = new Map();
const loginAttempts = new Map();
if (!process.env.ADMIN_PASSWORD) console.log('Admin password (development): ' + adminPassword);
const sessionCookie = 'odau_admin';
function getAdminSession(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)odau_admin=([a-f0-9]+)/i)?.[1];
  const expires = token && adminSessions.get(token);
  if (!expires || expires < Date.now()) { if (token) adminSessions.delete(token); return null; }
  return token;
}
const isAdmin = req => Boolean(getAdminSession(req));//
const dbPath = path.join(__dirname, 'data', 'odau.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, price REAL NOT NULL,
    area REAL NOT NULL, type TEXT NOT NULL, district TEXT NOT NULL, ward TEXT DEFAULT '',
    street TEXT NOT NULL, province TEXT NOT NULL, image TEXT NOT NULL, badge TEXT DEFAULT 'Mới đăng',
    amenities TEXT NOT NULL DEFAULT '[]', lat REAL NOT NULL, lng REAL NOT NULL,
    description TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS listing_images (
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, mime_type TEXT NOT NULL, data BLOB NOT NULL,
    PRIMARY KEY(listing_id, position)
  );
  CREATE TABLE IF NOT EXISTS saved_listings (
    visitor_id TEXT NOT NULL, listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(visitor_id, listing_id)
  );
  CREATE TABLE IF NOT EXISTS listing_videos (
    listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    mime_type TEXT NOT NULL, data BLOB NOT NULL
  );
`);
if (!db.prepare('PRAGMA table_info(listings)').all().some(column => column.name === 'gallery')) db.exec("ALTER TABLE listings ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]'");
if (!db.prepare('PRAGMA table_info(listings)').all().some(column => column.name === 'deposit_amount')) db.exec('ALTER TABLE listings ADD COLUMN deposit_amount REAL');
// Move legacy uploads from the old public folder into SQLite, then remove those files.
const legacyUploadDir = path.join(__dirname, 'public', 'uploads');
if (fs.existsSync(legacyUploadDir)) {
  const legacyImageInsert = db.prepare('INSERT OR IGNORE INTO listing_images(listing_id,position,mime_type,data) VALUES(?,?,?,?)');
  const legacyRows = db.prepare("SELECT id,image,gallery FROM listings WHERE image LIKE '/uploads/%'").all();
  for (const row of legacyRows) {
    const refs = [row.image, ...JSON.parse(row.gallery || '[]')];
    refs.forEach((ref, position) => {
      const filename = path.basename(ref);
      const file = path.join(legacyUploadDir, filename);
      if (!fs.existsSync(file)) return;
      const data = fs.readFileSync(file);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      legacyImageInsert.run(row.id, position, mime, data);
    });
    db.prepare('UPDATE listings SET image=?, gallery=? WHERE id=?').run('db-image:', JSON.stringify(refs.slice(1).map(() => 'db-image:')), row.id);
  }
  fs.rmSync(legacyUploadDir, { recursive: true, force: true });
}
const count = db.prepare('SELECT COUNT(*) AS n FROM listings').get().n;
if (!count) {
  const insert = db.prepare(`INSERT INTO listings(title,price,area,type,district,ward,street,province,image,badge,amenities,lat,lng,description,phone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const seed = [
    ['Studio đầy nắng, ban công thoáng',4.2,32,'Studio','Bình Thạnh','Phường 25','Xô Viết Nghệ Tĩnh','TP. Hồ Chí Minh','photo-1522708323590-d24dbb6b0267','Nổi bật',['Máy lạnh','Ban công','Cho nuôi thú cưng'],10.803,106.712,'Studio sáng thoáng, nội thất gọn gàng và ban công đón nắng. Gần trường đại học, cửa hàng tiện lợi và tuyến xe buýt.','0901234567'],
    ['Phòng xinh ngay trung tâm Bình Thạnh',3.1,25,'Phòng trọ','Bình Thạnh','Phường 17','Nguyễn Hữu Cảnh','TP. Hồ Chí Minh','photo-1524758631624-e2822e304c36','Mới đăng',['Máy lạnh','WC riêng','Gần bến xe'],10.791,106.720,'Phòng gọn gàng, có cửa sổ lớn và máy lạnh. Hẻm xe máy thông thoáng, di chuyển thuận tiện ra Quận 1.','0902345678'],
    ['Căn hộ mini nội thất trọn gói',5.8,38,'Căn hộ mini','Quận 3','Phường 9','Cách Mạng Tháng 8','TP. Hồ Chí Minh','photo-1600210492486-724fe5c67fb0','Giá tốt',['Máy lạnh','Nội thất','Cho nuôi thú cưng'],10.778,106.684,'Căn hộ mini đủ nội thất, thiết kế hiện đại. Có thang máy, bảo vệ và giờ giấc tự do.','0903456789'],
    ['Phòng riêng gần công viên Gia Định',2.7,20,'Phòng trọ','Gò Vấp','Phường 3','Nguyễn Thái Sơn','TP. Hồ Chí Minh','photo-1616486338812-3dadae4b4ace','Giá tốt',['WC riêng','Gần công viên','Cho nuôi thú cưng'],10.814,106.680,'Phòng riêng sạch sẽ, thoáng mát. Cách công viên vài phút đi bộ, gần chợ và trạm xe buýt.','0904567890'],
    ['Ở ghép văn minh, đầy đủ tiện nghi',1.9,16,'Ở ghép','Quận 10','Phường 12','Tô Hiến Thành','TP. Hồ Chí Minh','photo-1522771739844-6a9f6d5f14af','Tiết kiệm',['Máy lạnh','Máy giặt','WC riêng'],10.771,106.666,'Phòng ở ghép sạch, có khu vực sinh hoạt chung và đầy đủ tiện ích. Ưu tiên người đi làm hoặc sinh viên gọn gàng.','0905678901'],
    ['Studio yên tĩnh, gần Đại học Quốc gia',3.6,28,'Studio','Thủ Đức','Linh Trung','Đường số 6','TP. Hồ Chí Minh','photo-1505693416388-ac5ce068fe85','Mới đăng',['Máy lạnh','Bếp riêng','Gần trường'],10.870,106.803,'Studio có bếp riêng, cửa sổ thoáng và chỗ để xe an toàn. Gần Đại học Quốc gia và ga Metro Suối Tiên.','0906789012']
  ];
  for (const row of seed) insert.run(...row.slice(0,10), JSON.stringify(row[10]), ...row.slice(11));
}

const demoLocations = [
  ['0901234567','Studio g\u1ea7n b\u1ebfn Ninh Ki\u1ec1u','Ninh Ki\u1ec1u','An C\u01b0','M\u1eadu Th\u00e2n',10.031,105.777],
  ['0902345678','Ph\u00f2ng tho\u00e1ng g\u1ea7n c\u00f4ng vi\u00ean L\u01b0u H\u1eefu Ph\u01b0\u1edbc','Ninh Ki\u1ec1u','Xu\u00e2n Kh\u00e1nh','30 Th\u00e1ng 4',10.028,105.770],
  ['0903456789','C\u0103n h\u1ed9 mini ti\u1ec7n nghi t\u1ea1i C\u1ea7n Th\u01a1','Ninh Ki\u1ec1u','An H\u00f2a','Nguy\u1ec5n V\u0103n C\u1eeb',10.045,105.777],
  ['0904567890','Ph\u00f2ng ri\u00eang khu B\u00ecnh Th\u1ee7y','B\u00ecnh Th\u1ee7y','B\u00ecnh Th\u1ee7y','L\u00ea H\u1ed3ng Phong',10.065,105.746],
  ['0905678901','\u1ede gh\u00e9p g\u1ea7n trung t\u00e2m Ninh Ki\u1ec1u','Ninh Ki\u1ec1u','T\u00e2n An','H\u00f2a B\u00ecnh',10.035,105.785],
  ['0906789012','Studio y\u00ean t\u0129nh t\u1ea1i C\u00e1i R\u0103ng','C\u00e1i R\u0103ng','H\u01b0ng Ph\u00fa','Nguy\u1ec5n V\u0103n Linh',10.002,105.766]
];
const moveDemo = db.prepare('UPDATE listings SET title=?, province=?, district=?, ward=?, street=?, lat=?, lng=? WHERE phone=?');
for (const [phone,title,district,ward,street,lat,lng] of demoLocations) moveDemo.run(title,'C\u1ea7n Th\u01a1',district,ward,street,lat,lng,phone);
const canThoUniversitiesAndColleges = [
  {id:'ctu',name:'Đại học Cần Thơ',lat:10.0299,lng:105.7680},
  {id:'ctump',name:'Trường Đại học Y Dược Cần Thơ',lat:10.0375,lng:105.7653},
  {id:'nctu',name:'Trường Đại học Nam Cần Thơ',lat:9.9915,lng:105.7410},
  {id:'tdu',name:'Trường Đại học Tây Đô',lat:9.99968,lng:105.76032},
  {id:'ctut',name:'Trường Đại học Kỹ thuật – Công nghệ Cần Thơ',lat:10.0455,lng:105.7555},
  {id:'fpt-can-tho',name:'Trường Đại học FPT Cần Thơ',lat:10.01193,lng:105.73156},
  {id:'greenwich-can-tho',name:'Đại học Greenwich – Cơ sở Cần Thơ',lat:10.01193,lng:105.73156},
  {id:'hcmua-can-tho',name:'Trường Đại học Kiến trúc TP.HCM – Cơ sở Cần Thơ',lat:9.9950,lng:105.7800},
  {id:'cd-can-tho',name:'Trường Cao đẳng Cần Thơ',lat:10.0085,lng:105.7560},
  {id:'ctec',name:'Trường Cao đẳng Kinh tế – Kỹ thuật Cần Thơ',lat:10.0430,lng:105.7460},
  {id:'cd-y-te-can-tho',name:'Trường Cao đẳng Y tế Cần Thơ',lat:10.0442,lng:105.7653},
  {id:'cd-du-lich-can-tho',name:'Trường Cao đẳng Du lịch Cần Thơ',lat:10.0660,lng:105.7510},
  {id:'cd-nghe-can-tho',name:'Trường Cao đẳng Nghề Cần Thơ',lat:10.0425,lng:105.7470}
];
async function getSchools() { return canThoUniversitiesAndColleges; }
function distanceMeters(a,b){const rad=n=>n*Math.PI/180,lat1=rad(a.lat),lat2=rad(b.lat),dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}
const send = (res, status, body, headers={}) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => {
  let raw = '', size = 0, tooLarge = false;
  req.on('data', chunk => { size += chunk.length; if (size > 30 * 1024 * 1024) { tooLarge = true; raw = ''; } else if (!tooLarge) raw += chunk; });
  req.on('end', () => { if (tooLarge) return reject(Object.assign(new Error('Tổng dung lượng yêu cầu vượt quá 30 MB.'), { status: 413 })); try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('JSON không hợp lệ.')); } });
});
function saveListingPhotos(photos, coverIndex) {
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 8) throw Object.assign(new Error('Choose between 1 and 8 images.'), { status: 400 });
  if (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= photos.length) throw Object.assign(new Error('Choose a cover image.'), { status: 400 });
  let total = 0;
  const saved = photos.map(photo => {
    const match = String(photo?.data || '').match(/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/]+=*)$/);
    if (!match) throw Object.assign(new Error('Images must be JPG, PNG, or WebP.'), { status: 400 });
    const buffer = Buffer.from(match[2], 'base64'); total += buffer.length;
    if (!buffer.length || buffer.length > 1.5 * 1024 * 1024 || total > 8 * 1024 * 1024) throw Object.assign(new Error('Each image must be under 1.5 MB and all images under 8 MB.'), { status: 400 });
    const signatures = { jpeg: buffer[0] === 0xff && buffer[1] === 0xd8, png: buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), webp: buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP' };
    if (!signatures[match[1]]) throw Object.assign(new Error('Invalid image file.'), { status: 400 });
    return { buffer, mime: 'image/' + match[1] };
  });
  return [saved[coverIndex], ...saved.filter((_, index) => index !== coverIndex)];
}
function saveListingVideo(video) {
  if (!video?.data) return null;
  const match=String(video.data).match(/^data:video\/(mp4|webm);base64,([a-zA-Z0-9+/]+=*)$/);
  if(!match) throw Object.assign(new Error('Video phải có định dạng MP4 hoặc WebM.'),{status:400});
  const buffer=Buffer.from(match[2],'base64');
  if(!buffer.length||buffer.length>12*1024*1024) throw Object.assign(new Error('Video không được vượt quá 12 MB.'),{status:400});
  const valid=match[1]==='mp4'?buffer.toString('ascii',4,8)==='ftyp':buffer.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(!valid) throw Object.assign(new Error('Nội dung video không hợp lệ.'),{status:400});
  return {buffer,mime:'video/'+match[1]};
}

const format = row => {
  if (!row) return row;
  const angle = (row.id * 137.508) * Math.PI / 180;
  const distance = 180 + (row.id * 47 % 90);
  const latitudeOffset = Math.sin(angle) * distance / 111320;
  const longitudeOffset = Math.cos(angle) * distance / (111320 * Math.max(.2,Math.cos(row.lat*Math.PI/180)));
  const gallery = row.gallery ? JSON.parse(row.gallery) : [];
  const uploaded = String(row.image).startsWith('db-image:');
  const images = uploaded ? Array.from({length: gallery.length + 1}, (_, index) => '/api/listings/' + row.id + '/images/' + index) : [row.image,...gallery];
  return {...row, image:images[0], video:row.video_mime?'/api/listings/'+row.id+'/video':null, lat:row.lat+latitudeOffset, lng:row.lng+longitudeOffset, approximate:true, amenities:JSON.parse(row.amenities), gallery:images.slice(1), images, saved:Boolean(row.saved)};
};
const listSql = `SELECT l.*, (SELECT mime_type FROM listing_videos v WHERE v.listing_id=l.id) AS video_mime, EXISTS(SELECT 1 FROM saved_listings s WHERE s.listing_id=l.id AND s.visitor_id=?) AS saved FROM listings l`;
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Headers':'Content-Type,X-Visitor-Id','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'}); return res.end(); }
  const visitor = (req.headers['x-visitor-id'] || 'guest').slice(0,80);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/config' && req.method === 'GET') return send(res, 200, { socialContacts: { zalo: process.env.ADMIN_ZALO_URL || '', facebook: process.env.ADMIN_FACEBOOK_URL || '', tiktok: process.env.ADMIN_TIKTOK_URL || '' } });
      if (url.pathname === '/api/schools' && req.method === 'GET') return send(res, 200, await getSchools());
      if (url.pathname === '/api/admin/status' && req.method === 'GET') return send(res, 200, { authenticated: isAdmin(req) });
      if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || 'unknown';
        const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
        if (attempt.until > Date.now()) return send(res, 429, { error: '\u0110\u0103ng nh\u1eadp qu\u00e1 nhi\u1ec1u l\u1ea7n. H\u00e3y th\u1eed l\u1ea1i sau.' });
        const body = await readBody(req);
        const submitted = crypto.createHash('sha256').update(String(body.password || '')).digest();
        const expected = crypto.createHash('sha256').update(adminPassword).digest();
        if (!crypto.timingSafeEqual(submitted, expected)) {
          attempt.count++;
          if (attempt.count >= 5) { attempt.count = 0; attempt.until = Date.now() + 15 * 60 * 1000; }
          loginAttempts.set(ip, attempt);
          return send(res, 401, { error: 'M\u1eadt kh\u1ea9u qu\u1ea3n tr\u1ecb kh\u00f4ng \u0111\u00fang.' });
        }
        loginAttempts.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        return send(res, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie + '=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + secure });
      }
      if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
        const token = getAdminSession(req); if (token) adminSessions.delete(token);
        return send(res, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      }
      if (url.pathname === '/api/listings' && req.method === 'GET') {
let rows = db.prepare(listSql + ' ORDER BY l.created_at DESC, l.id DESC').all(visitor);
        const schoolKm = Number(url.searchParams.get('schoolKm') || 0);
        const schoolId = url.searchParams.get('schoolId');
        if (schoolKm > 0 && schoolId) {
          const school = (await getSchools()).find(item => item.id === schoolId);
          if (school) rows = rows.filter(row => distanceMeters(row,school) <= schoolKm*1000);
        }
        return send(res,200,rows.map(format));
      }
      if (url.pathname === '/api/listings' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Ch\u1ec9 qu\u1ea3n tr\u1ecb vi\u00ean m\u1edbi c\u00f3 th\u1ec3 t\u1ea1o tin.' });
        const b=await readBody(req); const required=['title','price','area','type','district','street','province','lat','lng','description','phone'];
        const missing=required.filter(k=>b[k]===undefined||b[k]==='');
        if(missing.length) return send(res,400,{error:'Thiếu thông tin bắt buộc: '+missing.join(', ')});
        if(!Number.isFinite(+b.price)||!Number.isFinite(+b.area)||!Number.isFinite(+b.lat)||!Number.isFinite(+b.lng)) return send(res,400,{error:'Giá, diện tích hoặc vị trí trên bản đồ chưa hợp lệ.'});
        let uploaded,video; try { uploaded = saveListingPhotos(b.photos, Number(b.coverIndex)); video=saveListingVideo(b.video); } catch (error) { return send(res,error.status||400,{error:error.message}); }
        const depositAmount=b.depositAmount===null||b.depositAmount===undefined||b.depositAmount===''?null:Number(b.depositAmount);
        if(depositAmount!==null&&(!Number.isFinite(depositAmount)||depositAmount<0))return send(res,400,{error:'Số tiền cọc không hợp lệ.'});
        const result=db.prepare(`INSERT INTO listings(title,price,area,type,district,ward,street,province,image,gallery,badge,amenities,lat,lng,description,phone,deposit_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(String(b.title),+b.price,+b.area,String(b.type),String(b.district),String(b.ward||''),String(b.street),String(b.province),'db-image:',JSON.stringify(uploaded.slice(1).map(()=>'db-image:')),'M\u1edbi \u0111\u0103ng',JSON.stringify(Array.isArray(b.amenities)?b.amenities:[]),+b.lat,+b.lng,String(b.description),String(b.phone),depositAmount);
        const imageInsert=db.prepare('INSERT INTO listing_images(listing_id,position,mime_type,data) VALUES(?,?,?,?)');
        uploaded.forEach((photo,index)=>imageInsert.run(result.lastInsertRowid,index,photo.mime,photo.buffer));
        if(video)db.prepare('INSERT INTO listing_videos(listing_id,mime_type,data) VALUES(?,?,?)').run(result.lastInsertRowid,video.mime,video.buffer);
        return send(res,201,format(db.prepare(listSql+' WHERE l.id=?').get(visitor,result.lastInsertRowid)));
      }
      const videoMatch=url.pathname.match(/^\/api\/listings\/(\d+)\/video$/);
      if(videoMatch&&req.method==='GET'){const video=db.prepare('SELECT mime_type,data FROM listing_videos WHERE listing_id=?').get(+videoMatch[1]);if(!video)return send(res,404,{error:'Không tìm thấy video.'});const range=req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);if(range){const start=range[1]?Number(range[1]):Math.max(0,video.data.length-Number(range[2]));const end=range[2]&&range[1]?Math.min(Number(range[2]),video.data.length-1):video.data.length-1;if(start>=video.data.length||start>end){res.writeHead(416,{'Content-Range':`bytes */${video.data.length}`});return res.end()}res.writeHead(206,{'Content-Type':video.mime_type,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${video.data.length}`,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(video.data.subarray(start,end+1))}res.writeHead(200,{'Content-Type':video.mime_type,'Content-Length':video.data.length,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(video.data)}
      const imageMatch=url.pathname.match(/^\/api\/listings\/(\d+)\/images\/(\d+)$/);
      if(imageMatch && req.method==='GET') { const image=db.prepare('SELECT mime_type,data FROM listing_images WHERE listing_id=? AND position=?').get(+imageMatch[1],+imageMatch[2]); if(!image)return send(res,404,{error:'Image not found.'}); res.writeHead(200,{'Content-Type':image.mime_type,'Content-Length':image.data.length,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}); return res.end(image.data); }
      const detail=url.pathname.match(/^\/api\/listings\/(\d+)$/);
      if(detail && req.method==='GET'){const row=db.prepare(listSql+' WHERE l.id=?').get(visitor,+detail[1]);return row?send(res,200,format(row)):send(res,404,{error:'Không tìm thấy tin đăng.'})}
      const saved=url.pathname.match(/^\/api\/saved\/(\d+)$/);
      if(saved && req.method==='POST'){const exists=db.prepare('SELECT id FROM listings WHERE id=?').get(+saved[1]);if(!exists)return send(res,404,{error:'Tin đăng không tồn tại.'});db.prepare('INSERT OR IGNORE INTO saved_listings(visitor_id,listing_id) VALUES(?,?)').run(visitor,+saved[1]);return send(res,200,{saved:true})}
      if(saved && req.method==='DELETE'){db.prepare('DELETE FROM saved_listings WHERE visitor_id=? AND listing_id=?').run(visitor,+saved[1]);return send(res,200,{saved:false})}
      if(url.pathname==='/api/saved' && req.method==='GET'){return send(res,200,db.prepare(listSql+' JOIN saved_listings mine ON mine.listing_id=l.id AND mine.visitor_id=? ORDER BY mine.created_at DESC').all(visitor,visitor).map(format))}
      return send(res,404,{error:'API không tồn tại.'});
    }
    if (url.pathname === '/dang-tin') { res.writeHead(302, { Location: '/quan-tri/dang-tin' }); return res.end(); }
    if (url.pathname === '/quan-tri') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); return fs.createReadStream(path.join(__dirname,'public','admin.html')).pipe(res); }
    if (url.pathname === '/quan-tri/dang-tin' || url.pathname === '/create.html') {
      if (!isAdmin(req)) { res.writeHead(302, { Location: '/quan-tri' }); return res.end(); }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); return fs.createReadStream(path.join(__dirname,'public','create.html')).pipe(res);
    }
    const pages={'/':'index.html','/da-luu':'saved.html','/tai-khoan':'account.html'};
    const detail=url.pathname.match(/^\/tin\/(\d+)$/);
    const pagePath=pages[url.pathname] || (detail?'detail.html':null);
    if(pagePath){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(__dirname,'public',pagePath)).pipe(res)}
    const publicRoot=path.resolve(__dirname,'public');
    const asset=path.resolve(publicRoot,decodeURIComponent(url.pathname.slice(1)));
    if(asset.startsWith(publicRoot+path.sep) && fs.existsSync(asset) && fs.statSync(asset).isFile()){const ext=path.extname(asset);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});return fs.createReadStream(asset).pipe(res)}
    send(res,404,{error:'Không tìm thấy trang.'});
  } catch(err) { console.error(err);send(res,err.status||500,{error:err.message||'Lỗi máy chủ.'}); }
});
server.listen(port,()=>console.log(`Nhà Trọ Cần Thơ đang chạy tại http://localhost:${port}`));
