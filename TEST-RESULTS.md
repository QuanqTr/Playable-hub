# Kết quả kiểm tra

Lượt kiểm tra mới nhất: **24/10/2026**, múi giờ Asia/Ho_Chi_Minh. Môi trường local: Windows, Node.js **25.6.1**, pnpm **10.32.1**, Next.js **16.4.2**. Project Vercel đã build thành công với preset Next.js và runtime **Node.js 24.x**.

Production: [playable-hub-nu.vercel.app](https://playable-hub-nu.vercel.app). Source: [QuanqTr/Playable-hub](https://github.com/QuanqTr/Playable-hub).

## Đã chạy thành công

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `pnpm typecheck` | PASS | TypeScript strict, toàn bộ ứng dụng và test |
| `pnpm lint` | PASS | Không lỗi, không warning ESLint |
| `pnpm test` | **39/39 PASS** | Validation, server actions, download/auth callback, upload, cleanup và liên kết Invite/Recovery mặc định |
| `pnpm test:db` | **67/67 PASS** | Migration thực thi trên PGlite/PostgreSQL với Auth/Storage stub |
| `pnpm build` | PASS | Production build Next.js, các route và Proxy |
| `pnpm test:e2e` | **3/3 PASS (23/10)** | Edge headless, Next.js thật, HTTP backend fixture; chưa chạy lại browser test sau bản sửa callback mặc định |
| HTTP smoke bản build local (23/10) | PASS | `/` redirect dự án; dự án/playable redirect thiết lập khi thiếu cấu hình; setup/login 200; file API 503 và không cấp file khi chưa cấu hình |
| Kiểm tra ảnh desktop/mobile | PASS | Xem trực tiếp ảnh 1440px và 390px, không tràn ngang trang; panel mobile toàn màn hình |
| Migration Supabase cloud | PASS (23/10) | SQL Editor báo thành công, tạo schema/RLS/private buckets từ migration ban đầu |
| Anonymous API Supabase cloud | PASS (23/10) | 5 bảng và RPC trả 401/42501; public sign-up đã tắt; Storage anonymous chỉ trả danh sách trống |
| Vercel production ban đầu | PASS | Deployment READY, Node.js 24.x, trang đăng nhập đã được mở và kiểm tra thực tế |
| Vercel production sau bản sửa Auth (24/10) | PASS | Commit `96a65c9` READY qua Vercel API; `/login` và `/auth/complete` trả 200 với đúng tiêu đề; `/projects` và `/playables` trả 307 tới `/login`; API file trả 401 khi chưa đăng nhập |

`pnpm verify` đã chạy thành công toàn bộ typecheck → lint → unit test → PostgreSQL test → production build sau các chỉnh sửa cuối.

### Bản sửa liên kết email mặc định

Supabase Free hiện không cho tùy chỉnh email khi chưa có SMTP riêng. Đã bổ sung `/auth/complete` và listener chuyển fragment Invite/Recovery từ Site URL sang route này; xóa token khỏi địa chỉ trước khi gọi Auth, lưu cookie bằng SSR client, xác minh user rồi mới chuyển sang trang tự đặt mật khẩu. Sáu unit test mới kiểm tra dữ liệu thiếu/sai/trùng, loại luồng không được hỗ trợ, thứ tự xác thực và lỗi không lộ token. Code đã được rà soát độc lập; chưa xác nhận luồng email thật trước khi thành viên đầu tiên nhận lời mời.

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

- Supabase Auth thật: gửi/nhận lời mời, recovery, cookie refresh và kiểm tra phiên thành viên. Public sign-up đã được tắt và kiểm tra qua API; thao tác gửi lời mời đầu tiên chưa hoàn tất vì kết nối trình duyệt bị lỗi.
- Supabase Storage thật: upload/download blob, MIME/size rejection ở dịch vụ, signed URL thực tế và thời điểm hết hạn.
- `supabase test db`/pgTAP trên Supabase local hoặc cloud test; chưa có stack Docker/Supabase local được cấu hình.
- `supabase/tests/concurrency.mjs`: 24 request HTTP song song; cần Supabase test project và tài khoản test được mời. Sequence đã được kiểm tra bằng SQL, nhưng chưa khẳng định đã chạy test HTTP cạnh tranh.
- Kiểm tra CRUD và upload/download bằng tài khoản thật trên production; cần thành viên đầu tiên tự đặt mật khẩu.

## Trạng thái cấu hình và bước còn lại

1. Đã cấu hình hai biến public Supabase trong `.env.local` và Vercel. `.env.local` không được commit.
2. Đã chạy migration trên project `mslinuppummnkdtguqet` qua SQL Editor.
3. Đã tắt sign-up, đặt Site URL production và lưu 12 callback URL cụ thể cho production/local. Dùng mẫu email mặc định, không nâng gói hoặc đăng ký dịch vụ SMTP.
4. Còn gửi lời mời thành viên đầu tiên và để chủ tài khoản tự đặt mật khẩu; không có mật khẩu mới nào được agent tạo.
5. Sau đó thực hiện checklist Auth/CRUD/Storage thực tế trong README. Mời email ngoài tổ chức Supabase cần SMTP riêng theo giới hạn dịch vụ.

Không có secret/service-role key trong source và không có dữ liệu demo tự chèn vào production.
