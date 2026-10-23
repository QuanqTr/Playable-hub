# Kết quả kiểm tra

Ngày: **23/10/2026**, múi giờ Asia/Ho_Chi_Minh. Môi trường thực thi: Windows, Node.js **25.6.1**, pnpm **10.32.1**, Next.js **16.4.2**. Chưa xác minh runtime Node.js 22/24 trên Vercel.

## Đã chạy thành công

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `pnpm typecheck` | PASS | TypeScript strict, toàn bộ ứng dụng và test |
| `pnpm lint` | PASS | Không lỗi, không warning ESLint |
| `pnpm test` | **33/33 PASS** | Validation, server actions, download/auth callback, upload và lỗi cleanup |
| `pnpm test:db` | **67/67 PASS** | Migration thực thi trên PGlite/PostgreSQL với Auth/Storage stub |
| `pnpm build` | PASS | Production build Next.js, các route và Proxy |
| `pnpm test:e2e` | **3/3 PASS** | Edge headless, Next.js thật, HTTP backend fixture chỉ dùng cho kiểm thử |
| HTTP smoke production local | PASS | `/` redirect dự án; dự án/playable redirect thiết lập khi thiếu cấu hình; setup/login 200; file API 503 và không cấp file khi chưa cấu hình |
| Kiểm tra ảnh desktop/mobile | PASS | Xem trực tiếp ảnh 1440px và 390px, không tràn ngang trang; panel mobile toàn màn hình |

`pnpm verify` đã chạy thành công toàn bộ typecheck → lint → unit test → PostgreSQL test → production build sau các chỉnh sửa cuối.

### Luồng Playwright đã xác minh

1. Người chưa đăng nhập bị chuyển sang đăng nhập; đăng nhập, tạo dự án, sửa owner/trạng thái, reload giữ dữ liệu; trang dùng được ở mobile; đăng xuất rồi truy cập lại bị chặn.
2. Phân trang 12 + 2 bản ghi; tạo playable bằng URL, kết hợp từ khóa/win/network qua URL, mở panel, sửa notes/win và reload; URL nguồn bị khóa; đóng panel giữ bộ lọc; lưu trữ có xác nhận và khôi phục.
3. Upload HTML trực tiếp, giả lập database lưu lỗi, giữ nội dung form và dọn object mới; thử lại thành công; tải file về có cùng tên và nội dung byte với file đã upload.

Fixture chỉ nằm trong `tests/e2e/supabase-fixture.mjs`; ứng dụng production không import hoặc tự sử dụng nó. Đây là kiểm tra hành vi ứng dụng với backend mô phỏng, **không phải** kiểm tra tích hợp Supabase cloud.

Ảnh QA có dữ liệu fixture dành riêng cho kiểm thử:

- [Kho playable desktop](artifacts/qa/desktop.png)
- [Panel mobile](artifacts/qa/mobile.png)

### Các invariant database đã xác minh

- Migration, network seed, bucket private và cấu hình giới hạn dung lượng.
- Anonymous/nonmember không đọc được bảng, email thành viên, RPC hoặc object; thành viên có thể cộng tác ngang nhau.
- Audit lấy actor từ `auth.uid()`, giữ người tạo, cập nhật người sửa, kể cả thao tác trực tiếp trên quan hệ network.
- Nguồn file/URL, mã và định danh không được thay đổi. Object được tham chiếu không thể bị xóa; khóa ngoại bảo vệ tham chiếu trong trường hợp cạnh tranh giữa save/cleanup.
- Lỗi trong lúc ghi network rollback cả metadata và quan hệ đã xóa trước đó.
- Filter kết hợp, count, archive của playable/dự án, khôi phục, thứ tự ổn định, phân trang và mã không trùng khi sequence vượt sáu chữ số.

## Chưa chạy vì thiếu cấu hình/dịch vụ

- Supabase Auth thật: lời mời email, recovery, cookie refresh, vô hiệu hóa sign-up và kiểm tra phiên qua dịch vụ thực tế.
- Supabase Storage thật: upload/download blob, MIME/size rejection ở dịch vụ, signed URL thực tế và thời điểm hết hạn.
- `supabase test db`/pgTAP trên Supabase local hoặc cloud test; chưa có stack Docker/Supabase local được cấu hình.
- `supabase/tests/concurrency.mjs`: 24 request HTTP song song; cần Supabase test project và tài khoản test được mời. Sequence đã được kiểm tra bằng SQL, nhưng chưa khẳng định đã chạy test HTTP cạnh tranh.
- Deploy Vercel và kiểm tra URL production: chưa có credentials/project/domain.

## Cấu hình cần điền để chạy thật

1. `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` trong `.env.local`/Vercel.
2. Chạy SQL migration trên Supabase mới.
3. Tắt sign-up công khai, cấu hình Site URL/redirect allowlist và mẫu Invite/Recovery trong Dashboard.
4. Mời thành viên đầu tiên theo README.
5. Deploy Vercel và thực hiện checklist tích hợp thực tế trong README.

Chưa có URL deployment được xác nhận. Không có secret/service-role key trong source và không có dữ liệu demo tự chèn vào production.
