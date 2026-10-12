# Nhà Trọ Cần Thơ

Ứng dụng đăng tin phòng trọ. Giao diện chạy trên Vercel, nội dung tin đăng lưu trong PostgreSQL (Neon qua Vercel Marketplace); ảnh và video tải trực tiếp từ trình duyệt lên UploadThing. PostgreSQL chỉ lưu metadata tin đăng và URL file.

## Cấu hình UploadThing

1. Tạo ứng dụng tại https://uploadthing.com/dashboard.
2. Mở ứng dụng vừa tạo → **API Keys** → tab **V7**.
3. Copy token V7; thêm vào Vercel Environment Variables với tên `UPLOADTHING_TOKEN`. Không để token trong GitHub.
4. Mỗi ảnh tối đa 2 MB; tối đa 8 ảnh/tin. Video tối đa 16 MB. Giới hạn này được cấu hình ở `api/uploadthing.js`.

## Deploy Vercel

1. Push repository lên GitHub rồi import repository vào Vercel (Framework Preset: **Other**, Root Directory: thư mục chứa `package.json`).
2. Kết nối PostgreSQL Neon qua Vercel Marketplace. API đọc `DATABASE_URL`, `POSTGRES_URL` hoặc `POSTGRES_DATABASE_URL`.
3. Vào **Project → Settings → Environment Variables**, thêm các biến sau cho Production và Preview:

| Key | Giá trị |
| --- | --- |
| `ADMIN_PASSWORD` | Mật khẩu trang quản trị |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên dài để ký cookie quản trị |
| `UPLOADTHING_TOKEN` | Token V7 trong UploadThing → API Keys |

4. Đảm bảo Build Command là `npm run build`; lệnh này tạo browser bundle UploadThing trong `public/js/uploadthing-client.js`.
5. Deploy hoặc redeploy. Mỗi lần đổi Environment Variables cần tạo deployment mới.
6. Mở `https://<domain-vercel>/quan-tri`, đăng nhập rồi đăng thử tin có ảnh/video. Tệp xuất hiện trong UploadThing dashboard; thông tin tin và URL tệp được lưu trong PostgreSQL.

Có thể tạo `SESSION_SECRET` bằng PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Chạy local

Server local cũ (`npm start`) vẫn dùng SQLite. Để thử các API serverless mới, dùng Vercel CLI (`vercel dev`) sau khi liên kết project và cấu hình các biến môi trường Development.

## Dữ liệu cũ

Các tin hiện có trong PostgreSQL giữ nguyên. URL media R2 đã lưu trước đó vẫn được hiển thị nếu bucket/domain R2 cũ còn hoạt động; các upload mới dùng UploadThing. File R2 không tự được chuyển sang UploadThing.
