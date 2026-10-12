-- Mẫu dữ liệu trường ở Cần Thơ. Tọa độ ghim tham khảo, hãy kiểm tra/điều chỉnh
-- theo cổng chính của từng cơ sở trước khi dùng chính thức.
INSERT INTO schools (id, name, address, lat, lng) VALUES
  ('ctu', 'Đại học Cần Thơ', 'Khu II, Đường 3/2, Ninh Kiều, Cần Thơ', 10.0299337, 105.7706153),
  ('ctump', 'Đại học Y Dược Cần Thơ', '179 Nguyễn Văn Cừ, Cần Thơ', 10.03462, 105.75541),
  ('nctu', 'Đại học Nam Cần Thơ', '168 Nguyễn Văn Cừ nối dài, Cần Thơ', 10.0070868, 105.7226855),
  ('tdu', 'Đại học Tây Đô', '68 Trần Chiên, Cái Răng, Cần Thơ', 9.99968, 105.76032),
  ('ctuet', 'Đại học Kỹ thuật - Công nghệ Cần Thơ', '256 Nguyễn Văn Cừ, Cái Khế, Cần Thơ', 10.0378, 105.7535),
  ('vttu', 'Đại học Võ Trường Toản', 'Quốc lộ 1A, Tân Phú Thạnh, Cần Thơ', 9.9700, 105.6410),
  ('fpt-university', 'Đại học FPT Cần Thơ', '600 Nguyễn Văn Cừ nối dài, An Bình, Cần Thơ', 10.0051, 105.7218),
  ('uah-can-tho', 'Đại học Kiến trúc TP.HCM - Cơ sở Cần Thơ', 'Khu đô thị Nam sông Cần Thơ, Hưng Phú, Cần Thơ', 9.9980, 105.7890),
  ('college-cantho', 'Cao đẳng Cần Thơ', '413 Đường 30 Tháng 4, Tân An, Cần Thơ', 10.0098, 105.7580),
  ('college-fpt-poly', 'Cao đẳng FPT Polytechnic Cần Thơ', 'Đường số 22, Cái Răng, Cần Thơ', 9.9930, 105.7790),
  ('college-btec-fpt', 'Cao đẳng Anh Quốc BTEC FPT Cần Thơ', '41 Cách Mạng Tháng 8, Cái Khế, Cần Thơ', 10.0470, 105.7500),
  ('college-health', 'Cao đẳng Y tế Cần Thơ', '340 Nguyễn Văn Cừ, Cái Khế, Cần Thơ', 10.0450, 105.7520),
  ('college-cofer', 'Cao đẳng Kinh tế Đối ngoại - Cơ sở Cần Thơ', '8 Lê Hồng Phong, Thới An Đông, Cần Thơ', 10.0800, 105.7350),
  ('college-ktkt', 'Cao đẳng Kinh tế - Kỹ thuật Cần Thơ', '9 Cách Mạng Tháng 8, Cái Khế, Cần Thơ', 10.0460, 105.7510),
  ('college-tourism', 'Cao đẳng Du lịch Cần Thơ', '47 Đường số 1, Cồn Khương, Cái Khế, Cần Thơ', 10.0700, 105.7520),
  ('college-culture', 'Cao đẳng Văn hóa Nghệ thuật Cần Thơ', '188/35A Nguyễn Văn Cừ, Cái Khế, Cần Thơ', 10.0430, 105.7540),
  ('college-vocational', 'Cao đẳng Nghề Cần Thơ', '57 Cách Mạng Tháng 8, Bình Thủy, Cần Thơ', 10.0640, 105.7470),
  ('college-transport', 'Cao đẳng Giao thông Vận tải Trung ương VI - Cơ sở Cần Thơ', '288 Nguyễn Văn Linh, Tân An, Cần Thơ', 10.0140, 105.7520),
  ('college-taydo', 'Cao đẳng Tây Đô', '90 Quốc lộ 1A, Cái Răng, Cần Thơ', 9.9900, 105.7850),
  ('college-phamngocthach', 'Cao đẳng Phạm Ngọc Thạch Cần Thơ', 'D13-8-9 Đường số 9, Khu đô thị Long Thịnh, Hưng Phú, Cần Thơ', 9.9930, 105.7890),
  ('college-nambo', 'Cao đẳng Cơ điện và Nông nghiệp Nam Bộ', '184 Tỉnh lộ 923, Phước Thới, Cần Thơ', 10.1150, 105.7100)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;
