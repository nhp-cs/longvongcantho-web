# Nhà Trọ Cần Thơ

Ứng dụng tìm phòng trọ tại Cần Thơ. Giao diện tĩnh chạy trên Vercel, API dùng PostgreSQL và ảnh/video được tải trực tiếp từ trình duyệt lên Cloudflare R2. Database chỉ lưu dữ liệu tin đăng, metadata và URL media; không lưu byte ảnh/video.

## Deploy lên Vercel

1. Tạo PostgreSQL database (ví dụ Neon) và bucket Cloudflare R2.
2. Bật public access cho bucket hoặc gắn custom domain; đặt domain đó vào `R2_PUBLIC_URL` (không có dấu `/` cuối URL).
3. Trong bucket R2, cấu hình CORS cho domain Vercel của bạn, cho phép `PUT` và header `Content-Type`. Ví dụ:

```json
[{"AllowedOrigins":["https://your-domain.vercel.app"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"ExposeHeaders":[],"MaxAgeSeconds":3600}]
```

4. Import repository vào Vercel, framework preset chọn Other, sau đó thêm các Environment Variables:

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (nên dùng pooled connection) |
| `ADMIN_PASSWORD` | Mật khẩu quản trị mạnh |
| `SESSION_SECRET` | Chuỗi bí mật ngẫu nhiên dài, dùng ký cookie quản trị |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key, chỉ cấp quyền Object Read & Write cho bucket này |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | Tên bucket |
| `R2_PUBLIC_URL` | URL công khai của bucket/custom domain, không có `/` cuối |
| `CARTO_API_KEY` | Không bắt buộc |
| `ADMIN_ZALO_URL`, `ADMIN_FACEBOOK_URL`, `ADMIN_TIKTOK_URL` | Không bắt buộc |

5. Deploy. API tự tạo bảng PostgreSQL khi nhận request đầu tiên. Tin mẫu chỉ hiển thị trong server local cũ; database production bắt đầu trống.

## Chạy local

```powershell
npm install
$env:DATABASE_URL = 'postgresql://...'
$env:ADMIN_PASSWORD = 'mat-khau-manh'
$env:SESSION_SECRET = 'chuoi-bi-mat-ngau-nhien'
$env:R2_ACCOUNT_ID = '...'
$env:R2_ACCESS_KEY_ID = '...'
$env:R2_SECRET_ACCESS_KEY = '...'
$env:R2_BUCKET = '...'
$env:R2_PUBLIC_URL = 'https://media.example.com'
npm start
```

`npm start` vẫn chạy server local SQLite hiện có; API PostgreSQL/R2 được dùng trên Vercel. Không đưa các giá trị secret vào git. R2 public URL phải trỏ tới bucket public/custom domain để trình duyệt hiển thị ảnh và phát video.

## Ghi chú dữ liệu cũ

Database SQLite hiện tại nằm trong `data/odau.sqlite` và không tự được chuyển lên PostgreSQL. Nếu cần giữ tin cũ, cần xuất metadata sang PostgreSQL và chuyển file media sang R2 trước khi đổi domain production. Không có ảnh/video mới nào được ghi vào database của API Vercel.

## Giao diện

Trang chủ, bản đồ Leaflet, tin đã lưu, trang chi tiết và biểu mẫu quản trị là các file tĩnh trong `public/`. Vercel rewrites các đường dẫn trang đẹp về HTML tương ứng.
