# Playable Hub

Kho playable ads nội bộ theo dự án, triển khai theo [document.md](document.md). Giao diện tiếng Việt, Next.js App Router + TypeScript, Tailwind CSS và các primitive shadcn/ui dựa trên Radix. Supabase cung cấp Auth, Postgres và Storage; ứng dụng chuẩn bị để deploy trên Vercel.

**Ứng dụng dùng dữ liệu thật từ Supabase.** Nếu chưa có biến môi trường, trang `/setup` hướng dẫn thiết lập; không có cơ chế giả lập lưu thành công hoặc tự chèn demo data vào production.

Production: **[playable-hub-nu.vercel.app](https://playable-hub-nu.vercel.app)**. Source: [QuanqTr/Playable-hub](https://github.com/QuanqTr/Playable-hub). Supabase project: `mslinuppummnkdtguqet`.

## Chạy local

Yêu cầu Node.js 22 trở lên và pnpm 10.32.1. Các phiên bản đã được khóa trong `pnpm-lock.yaml`; TypeScript 5.9 và ESLint 9 được chọn để tương thích với bộ lint của Next.js 16.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Điền hai giá trị từ **Supabase Dashboard → Project Settings → API**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` cũng được hỗ trợ thay cho publishable key. Không sử dụng service-role key hoặc secret key trong ứng dụng này. `.env.local` đã được bỏ qua bởi Git.

```powershell
pnpm dev
```

Mở `http://127.0.0.1:3000`. Khởi động lại dev server sau khi sửa biến môi trường. Nếu dùng `localhost`, dùng nhất quán địa chỉ đó khi cấu hình Auth và mở thư mời.

## Thiết lập Supabase

### 1. Migration và Storage

Tạo Supabase project mới. Trong **SQL Editor**, chạy toàn bộ file:

[`supabase/migrations/202610230001_initial.sql`](supabase/migrations/202610230001_initial.sql)

Migration chạy trong transaction và chỉ chạy một lần trên schema mới. Nó tạo:

- `profiles`, liên kết `auth.users` và tự tạo hồ sơ khi mời/tạo tài khoản qua Auth; đồng bộ tên/email và backfill thành viên đã có.
- `projects`, `playables`, `networks`, `playable_networks` với constraint, khóa ngoại, index và RLS.
- Sequence sinh mã `PL-000001` an toàn khi tạo đồng thời. Mã có thể có khoảng trống sau rollback và không được đổi/tái sử dụng.
- RPC `save_playable` lưu metadata và network trong cùng transaction; `list_playables` tìm kiếm, lọc, đếm và phân trang 12 bản ghi ở Postgres.
- Bucket private `playable-builds`: HTML/ZIP, tối đa **50 MiB**; `playable-thumbnails`: PNG/JPG/WebP, tối đa **5 MiB**.
- Chính sách cho mọi thành viên quyền cộng tác như nhau; chặn người ẩn danh và xóa vĩnh viễn qua API thành viên.
- Audit trigger lấy người tạo/cập nhật từ `auth.uid()`, bảo vệ mã và nguồn build bất biến. Thay build hoặc URL cần bản ghi mới.

Không cần tạo bucket public hoặc thêm policy thủ công. Nếu điều chỉnh giới hạn kho, cập nhật đồng thời `lib/constants.ts`, schema validation, constraint SQL, `storage.buckets.file_size_limit` và cấu hình Storage tổng. Đây là giới hạn kho, không phải tiêu chuẩn của ad network.

Upload đi trực tiếp từ trình duyệt đến Storage, tên object dạng `user-id/random-uuid.ext`, không overwrite. Database chỉ lưu object path. `/api/files/[id]` xác thực ở server rồi cấp redirect sang signed URL có thời hạn 60 giây; file build dùng chế độ tải xuống. HTML/ZIP không được giải nén hay chạy trong ứng dụng. Thumbnail có endpoint riêng `?thumbnail=true`. Xóa file chỉ dùng Storage API, không xóa trực tiếp metadata trong `storage.objects`. [Tài liệu Storage](https://supabase.com/docs/guides/storage/security/access-control), [xóa object](https://supabase.com/docs/guides/storage/management/delete-objects).

### 2. Tắt đăng ký công khai

Trong **Authentication → Sign In / Providers** (tên mục có thể thay đổi theo Dashboard):

1. Bật Email/password.
2. **Tắt “Allow new users to sign up”**.
3. Tắt anonymous sign-ins và các provider công khai không dùng.

File `supabase/config.toml` cấu hình tương ứng cho Supabase local. **File này không tự thay đổi thiết lập Auth của project cloud**; phải tắt sign-up trong Dashboard. Không có trang đăng ký hoặc module quản lý thành viên trong ứng dụng.

### 3. Callback và mẫu thư mời

Trong **Authentication → URL Configuration**:

- Local **Site URL**: `http://127.0.0.1:3000`.
- Thêm chính xác các redirect URL:
  - `http://127.0.0.1:3000/auth/confirm`
  - `http://127.0.0.1:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/complete`
  - `http://127.0.0.1:3000/set-password`
- Nếu chọn `localhost`, thêm các URL cùng đường dẫn với host `localhost`.
- Production dùng domain HTTPS thực tế. Tránh wildcard rộng cho môi trường production.

Ứng dụng hỗ trợ **mẫu email mặc định** của Supabase: liên kết Invite/Recovery đưa về Site URL cùng fragment phiên; trình duyệt chuyển sang `/auth/complete`, xóa fragment khỏi địa chỉ trước khi xác thực, ghi cookie bằng Supabase SSR, xác minh user rồi mở `/set-password`. Chỉ chấp nhận luồng `invite` hoặc `recovery`; không hiển thị hay ghi log token.

Giữ **Site URL là origin** của ứng dụng, ví dụ `https://playable-hub-nu.vercel.app`. Trên project Free mới sử dụng SMTP mặc định, Supabase không cho sửa mẫu email. SMTP mặc định cũng chỉ gửi đến email thành viên của tổ chức Supabase; muốn mời đồng nghiệp ngoài tổ chức cần SMTP riêng. Đây là yêu cầu của dịch vụ, không phải phân quyền trong Playable Hub. [Thay đổi mẫu email trên Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), [giới hạn SMTP mặc định](https://supabase.com/docs/guides/auth/auth-smtp).

Nếu đã cấu hình SMTP riêng hoặc có quyền chỉnh sửa template, trong **Authentication → Email Templates → Invite user**, có thể thay liên kết xác nhận bằng:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite&amp;next=/set-password">
  Chấp nhận lời mời
</a>
```

Mẫu **Reset password** dùng:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/set-password">
  Đặt lại mật khẩu
</a>
```

Route `/auth/confirm` xác thực token hash với Supabase, nhận cookie phiên ở server và chuyển sang `/set-password`. `/auth/callback` hỗ trợ trao đổi PKCE code nếu sử dụng luồng tương ứng. Chỉ chấp nhận đường dẫn nội bộ khi redirect. Link lỗi/hết hạn đưa về đăng nhập với thông báo rõ ràng. [Hướng dẫn Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [mẫu thư Auth](https://supabase.com/docs/guides/auth/auth-email-templates).

Nếu dùng Supabase CLI local với Docker: chạy `supabase start`, `supabase db reset`, rồi lấy URL/key local từ `supabase status`. `config.toml` đã trỏ tới mẫu Invite/Recovery trong `supabase/templates/`; xem email ở Inbucket `http://127.0.0.1:54324` và mời user qua Studio `http://127.0.0.1:54323`. Thay đổi mẫu cloud trong Dashboard không áp dụng cho CLI local. [Cấu hình mẫu thư local](https://supabase.com/docs/guides/local-development/customizing-email-templates).

### 4. Mời thành viên đầu tiên và các thành viên tiếp theo

1. Hoàn tất migration và URL Configuration; dùng mẫu mặc định hoặc cấu hình template nếu tài khoản cho phép.
2. Vào **Authentication → Users → Add user → Invite user**.
3. Điền email thành viên và gửi lời mời.
4. Thành viên mở thư mời, đặt mật khẩu rồi đăng nhập.
5. Muốn đổi tên hiển thị, quản trị viên có thể cập nhật `raw_user_meta_data.display_name` bằng công cụ quản trị Auth; trigger sẽ đồng bộ sang `profiles`. Không sửa trực tiếp `auth.users` bằng code frontend.

Mọi tài khoản đã được mời/tạo bởi quản trị viên có quyền nghiệp vụ ngang nhau. Tắt sign-up không ngăn thao tác mời từ Dashboard. Khi cần khôi phục mật khẩu, quản trị viên gửi thư reset; không thêm public sign-up để giải quyết việc này.

## Sử dụng

- **Dự án**: tạo/sửa tên, mô tả, owner và trạng thái. `completed` chỉ là trạng thái; lưu trữ là thao tác riêng có xác nhận.
- **Chi tiết dự án**: quản lý playable trong dự án, nút thêm tự điền dự án hiện tại.
- **Kho playable**: bảng toàn công ty, thumbnail, owner dự án, network, win, ngày triển khai và ngày cập nhật.
- **Tìm kiếm**: tên dự án, tên hoặc mã playable. Kết hợp các bộ lọc rồi bấm **Áp dụng**. Từ khóa, bộ lọc và trang nằm trong URL.
- **Panel chi tiết**: mở tên playable hoặc menu thao tác. `?playable=<uuid>` có thể chia sẻ; đóng panel giữ bộ lọc/trang. `/playables/<uuid>` chuyển đến panel tương ứng.
- **File hoặc URL**: cần ít nhất một; nguồn build được khóa sau khi lưu. **Tạo bản sao** sao chép metadata và yêu cầu nguồn mới, mã mới, win mặc định “Chưa đánh giá”.
- **Win** là đánh giá thủ công tổng thể; không tự suy luận hoặc chuyển Win thành Scale.
- **Đã lưu trữ** là chế độ riêng để khôi phục. Khi lưu trữ dự án, các playable của dự án được ẩn khỏi kho mặc định mà không bị thay đổi trạng thái lưu trữ riêng. Khôi phục dự án sẽ hiển thị lại các build chưa được lưu trữ riêng.
- Khi upload/lưu lỗi, form giữ dữ liệu, hiển thị lỗi và dọn file mới upload bằng Storage API nếu có thể. Nếu dọn thất bại, UI báo rõ để quản trị viên kiểm tra object không được tham chiếu; không tự xóa file đã gắn với bản ghi.

## Kiểm tra

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
pnpm build
# Hoặc chạy lần lượt tất cả mục trên:
pnpm verify
```

- `tests/validation.test.ts`: dữ liệu bắt buộc, URL an toàn, file/thumbnail, giới hạn dung lượng, ngày không hợp lệ, network và bảo toàn URL bộ lọc/panel.
- `tests/server.test.ts`: mock backend để kiểm tra xác thực trước ghi, payload RPC transaction, lỗi database, audit từ phiên, signed download và callback an toàn.
- `tests/upload.test.ts`: upload trực tiếp, tiến độ theo byte, MIME/header, không overwrite, cleanup sau timeout/mất kết nối và xử lý lỗi cleanup.
- `tests/auth-redirect.test.ts`: liên kết Invite/Recovery mặc định, token thiếu/sai, xác minh phiên và lỗi callback không lộ token.
- `tests/database.mjs`: chạy migration trên **PGlite/PostgreSQL thực thi SQL** với schema Auth/Storage stub; kiểm tra RLS, cộng tác, audit, bất biến build, rollback transaction, policy Storage và phân trang. Không thay thế kiểm tra dịch vụ Supabase thật.
- `supabase/tests/database.test.sql`: pgTAP cho Supabase local/test; xem [hướng dẫn kiểm tra database](supabase/tests/README.md).
- `node --env-file=.env.local scripts/check-supabase.mjs`: kiểm tra kết nối chỉ đọc bằng public key. Anonymous bị chặn là kết quả đúng; script không thể chứng minh đầy đủ quyền thành viên hoặc schema chỉ bằng phản hồi ẩn danh.
- `supabase/tests/concurrency.mjs`: 24 request HTTP song song đến Supabase test project, kiểm tra mã duy nhất và phân trang. Cần hai biến public Supabase cùng `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` trong `.env.local`; chỉ dùng tài khoản được mời trong project test. Chạy `node --env-file=.env.local supabase/tests/concurrency.mjs`. Script sẽ tạo và lưu trữ dữ liệu kiểm tra.
- `pnpm test:e2e`: Playwright mở ứng dụng Next thật ở port 3100 với **HTTP fixture Supabase chỉ trong tests** ở port 54329, hoàn toàn tách khỏi dữ liệu production; kiểm tra UI và các hành vi ứng dụng. Không chứng minh Auth/Storage cloud hoạt động. Cấu hình hiện dùng Microsoft Edge đã cài trên Windows (`channel: "msedge"`); trên máy khác có thể đổi channel hoặc cài Chromium bằng `pnpm exec playwright install chromium` và bỏ channel trong `playwright.config.ts`. Để trống hai port kiểm thử trước khi chạy. Ảnh desktop/mobile được lưu vào `artifacts/qa/`.

### Checklist khi đã kết nối Supabase thật

- Mở `/projects`, `/playables` và `/api/files/<id>` trong cửa sổ chưa đăng nhập: không đọc được dữ liệu/file.
- Mời hai tài khoản, xác nhận thư mời, đặt mật khẩu, đăng nhập/đăng xuất; kiểm tra mật khẩu sai và token hết hạn.
- Cả hai tài khoản đều tạo/sửa dự án, đổi owner và trạng thái, cập nhật playable của nhau được.
- Tạo playable bằng HTML, ZIP hoặc URL; upload thumbnail. Tải xuống và so sánh đúng file gốc.
- Từ chối file sai loại/quá giới hạn ở client và Storage. Thử overwrite bằng API thành viên: bị chặn.
- Cập nhật win/notes/network, reload và xác nhận dữ liệu còn nguyên.
- Search theo tên dự án/tên/mã, kết hợp owner/status/win/network, chuyển trang; panel mở/đóng và Back giữ URL.
- Lưu trữ/khôi phục playable và dự án; mục mặc định và mục đã lưu trữ đúng quy tắc.
- Giả lập upload lỗi, lỗi RPC/network: không báo lưu thành công, form còn dữ liệu, file mới được dọn nếu có thể.
- Kiểm tra signed URL tải xuống và hết hạn, RLS bằng anon key, desktop/mobile và 24 request tạo đồng thời.

Kết quả thực thi tại thời điểm bàn giao được ghi trong [TEST-RESULTS.md](TEST-RESULTS.md). Các mục thiếu credentials được đánh dấu chưa chạy, không coi là đã vượt qua.

## Deploy Vercel

1. Đưa source lên repository của bạn, import project vào Vercel, chọn preset **Next.js** và Node.js 22 hoặc 24. [Node.js được Vercel hỗ trợ](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
2. Dùng `pnpm install --frozen-lockfile`, build `pnpm build`; output giữ mặc định Next.js. Có thể dùng CLI `vercel` nếu đã cấu hình tài khoản.
3. Đặt `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ở đúng môi trường Production/Preview, rồi deploy lại sau mỗi thay đổi biến public.
4. Trong Supabase, đổi Site URL sang `https://your-domain` và thêm `/auth/confirm`, `/auth/callback`, `/auth/complete`, `/set-password` cho domain đó vào allowlist.
5. Xác nhận mẫu Invite/Reset dùng Site URL production; mẫu mặc định đã được hỗ trợ. Nếu dùng Preview, chỉ thêm domain Preview cụ thể cần kiểm tra và tránh làm thư mời production trỏ sai môi trường.
6. Mở URL được Vercel cấp, kiểm tra auth/callback, CRUD, upload, download và checklist phía trên.

Không cần worker, queue, backend riêng hay service-role key. File được upload trực tiếp tới Supabase nên không đi qua giới hạn body của Vercel Functions.

Project hiện được kết nối với GitHub và deploy tự động từ nhánh `main`. Migration ban đầu đã được áp dụng qua SQL Editor; nếu về sau dùng Supabase CLI `db push`, cần đánh dấu migration `202610230001` đã áp dụng bằng `supabase migration repair --status applied 202610230001` trước, để không chạy lại lệnh tạo bảng.

## Cấu trúc chính

```text
app/(hub)/               Trang được bảo vệ, dự án và kho playable
app/auth/                Xác nhận thư mời/recovery và PKCE callback
app/api/files/[id]/      Signed download/thumbnail sau khi xác thực
components/              Bảng, filter, form, panel, xác nhận lưu trữ
components/ui/           Các primitive shadcn/ui sử dụng Radix
lib/actions.ts           Server actions kiểm tra dữ liệu và phiên
lib/data.ts              Truy vấn phía server, phân trang, RLS
lib/upload.ts            Upload trực tiếp có tiến độ và cleanup
lib/supabase/            Client/server factories và cấu hình
proxy.ts                 Làm mới và xác minh cookie phiên Supabase SSR
supabase/                Migration, Auth local config, pgTAP/integration scripts
tests/                   Validation, server, PostgreSQL và browser tests
```

MVP không có preview HTML, dashboard biểu đồ, Kanban, vai trò theo dự án, AI, bình luận hoặc API ad network.
