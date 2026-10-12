# Lòng Vòng Cần Thơ

Website đăng và tìm phòng trọ. Vercel chạy giao diện và API; Neon PostgreSQL lưu tin đăng, danh sách trường và tin đã lưu; ảnh/video mới tải trực tiếp lên UploadThing. Database chỉ giữ nội dung tin và URL media.

## Cấu hình production

Trong đúng Vercel project đang gắn domain website, mở **Settings → Environment Variables** và đặt các biến dưới đây cho **Production**:

| Biến | Giá trị |
| --- | --- |
| `POSTGRES_DATABASE_URL` | Connection string Neon, thường bắt đầu bằng `postgresql://` |
| `ADMIN_PASSWORD` | Mật khẩu để vào `/quan-tri` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên dài dùng ký cookie đăng nhập |
| `UPLOADTHING_TOKEN` | Token V7 trong UploadThing → API Keys |

Tạo `SESSION_SECRET` trong PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sau khi thay Environment Variables, tạo deployment mới để Vercel nạp giá trị.

## Bảng dữ liệu và danh sách trường

API tự tạo ba bảng `listings`, `saved_listings`, `schools` khi nhận request đầu tiên và kết nối được Neon. Không cần chạy migration trước.

Để thêm các trường mẫu ở Cần Thơ:

1. Mở Neon → project → **SQL Editor** (hoặc **Query**).
2. Mở file `database/schools-can-tho.sql` trong repo, copy toàn bộ SQL và chạy.
3. Kiểm tra `https://<domain>/api/schools`; kết quả phải là JSON gồm các trường.
4. Tải lại trang chủ để chọn trường và bán kính 1–10 km.

Tọa độ trong file mẫu là ghim tham khảo; hãy kiểm tra vị trí cổng trường trên bản đồ và sửa cột `lat`, `lng` nếu cần. Thêm trường khác bằng SQL:

```sql
INSERT INTO schools (id, name, address, lat, lng)
VALUES ('ma-truong', 'Tên trường', 'Địa chỉ', 10.0, 105.7);
```

Tin đăng được thêm qua `/quan-tri/dang-tin`, không nhập trực tiếp bằng SQL. Khi tạo tin, nhập thông tin phòng, chọn vị trí trên bản đồ, chọn ảnh/video rồi bấm **Đăng tin**. Ảnh tối đa 8 ảnh, video tối đa 16 MB; dữ liệu tin và URL ảnh/video được ghi vào Neon sau khi upload thành công.

## Routes API

- `GET /api/listings` — danh sách tin, hỗ trợ `schoolId` và `schoolKm`.
- `GET /api/listings/:id` — chi tiết tin.
- `GET /api/schools` — danh sách trường dùng cho lọc gần trường.
- `GET /api/saved`, `POST/DELETE /api/saved/:id` — tin đã lưu.
- `POST /api/admin/login`, `GET /api/admin/status`, `POST /api/admin/logout` — phiên quản trị.
- UploadThing dùng `/api/uploadthing`.

## Deploy lên Vercel

- Framework Preset: **Other**.
- Root Directory: thư mục có `package.json` và `vercel.json`.
- Build Command: `npm run build`.
- Node.js: 22 trở lên.
- Kết nối GitHub branch `main`; mỗi commit mới sẽ tạo deployment.

`npm run build` đóng gói UploadThing browser client. `server.js` là server SQLite cũ để chạy local, không phải entrypoint của Vercel.

## Xử lý lỗi nhanh

- `/api/listings` trả `[]`: API và Neon đã kết nối, nhưng chưa có tin đăng.
- `Thiếu POSTGRES_DATABASE_URL`: thêm biến đúng project/environment và deploy lại.
- `/api/admin/login` hiện HTML hoặc 404: kiểm tra deployment mới nhất đã có catch-all `api/[...path].js` và `vercel.json` không tự rewrite `/api/*` về chính nó.
- Không upload được: kiểm tra `UPLOADTHING_TOKEN` là token V7 và đã redeploy sau khi thêm.
- Bản đồ nền dùng OpenStreetMap, tự chuyển sang CARTO khi tile OSM lỗi. Bản đồ tin chỉ có ghim sau khi có tin đăng.

## Media cũ

URL media R2 đã có trong dữ liệu vẫn cần nơi lưu cũ để tiếp tục hiển thị; file R2 không tự chuyển sang UploadThing.
