-- Mẫu dữ liệu trường ở Cần Thơ. Tọa độ ghim tham khảo, hãy kiểm tra/điều chỉnh
-- theo cổng chính của từng cơ sở trước khi dùng chính thức.
INSERT INTO schools (id, name, address, lat, lng) VALUES
  ('ctu', 'Đại học Cần Thơ', 'Khu II, Đường 3/2, Ninh Kiều, Cần Thơ', 10.0299337, 105.7706153),
  ('ctump', 'Đại học Y Dược Cần Thơ', '179 Nguyễn Văn Cừ, Cần Thơ', 10.03462, 105.75541),
  ('nctu', 'Đại học Nam Cần Thơ', '168 Nguyễn Văn Cừ nối dài, Cần Thơ', 10.0070868, 105.7226855),
  ('tdu', 'Đại học Tây Đô', '68 Trần Chiên, Cái Răng, Cần Thơ', 9.99968, 105.76032)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;
