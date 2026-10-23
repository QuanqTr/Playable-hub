Bạn là Senior Full-stack Developer kiêm Product Designer. Hãy xây dựng website nội bộ “Playable Hub” để lưu trữ và tra cứu playable ads đã triển khai theo từng dự án.

Hãy trực tiếp triển khai code và kiểm tra các luồng chính. Đọc repository và hướng dẫn hiện có trước khi làm. Nếu repository trống, khởi tạo dự án mới. Ưu tiên phiên bản MVP gọn, hoạt động đầy đủ; không mở rộng ngoài phạm vi.

1. MỤC TIÊU

Website giúp mọi thành viên:

- Lưu playable ads theo dự án.
- Tìm kiếm và lọc nhanh.
- Cập nhật trạng thái dự án.
- Đánh giá mức độ win của playable.
- Biết người chịu trách nhiệm chính của mỗi dự án.

Đây là kho tài sản chung. Mọi thành viên đã đăng nhập có quyền xem, tạo và chỉnh sửa như nhau. Không phân quyền theo UA/Design hoặc theo dự án.

2. TECH STACK

- Next.js App Router + TypeScript.
- Tailwind CSS + shadcn/ui.
- Supabase: Postgres, Auth, Storage.
- Vercel: deploy ứng dụng.
- Dùng phiên bản stable tương thích tại thời điểm triển khai.
- Không cần worker, queue hoặc backend riêng cho MVP.

3. PHẠM VI CHỨC NĂNG

A. Quản lý dự án

- Tạo và chỉnh sửa dự án.
- Tên dự án: bắt buộc.
- Mô tả: tùy chọn.
- Người chịu trách nhiệm: một thành viên, bắt buộc.
- Trạng thái:
  - active: Đang hoạt động.
  - paused: Tạm dừng.
  - completed: Đã kết thúc.
- Hiển thị số playable và thời gian cập nhật.
- Có chức năng lưu trữ và khôi phục dự án.
- Lưu trữ khác với trạng thái “Đã kết thúc”.
- Không xóa vĩnh viễn trong giao diện MVP.

B. Quản lý playable

- Mỗi playable thuộc một dự án.
- Mỗi bản ghi đại diện cho một build đã triển khai.
- Thông tin:
  - Mã playable tự sinh, duy nhất, không thay đổi.
  - Tên: bắt buộc.
  - Dự án: bắt buộc.
  - File HTML/ZIP hoặc URL lưu trữ: phải có ít nhất một.
  - Thumbnail: tùy chọn.
  - Network đã triển khai: cho chọn nhiều.
  - Ngày triển khai: tùy chọn để nhập dữ liệu cũ.
  - Mức độ win.
  - Ghi chú.
  - Người tạo, người cập nhật, thời gian tạo/cập nhật.
- Network ban đầu: Unity Ads, Mintegral, AppLovin, Meta, Google Ads, TikTok, Khác.
- Có thể tạo bản sao để nhập một build mới.
- Không cho ghi đè hoặc thay file của build đã lưu bằng file khác; tạo bản ghi mới nếu đổi build.
- Có lưu trữ và khôi phục playable.
- Chỉ cần tải file/mở link. Chưa chạy nội dung HTML trong ứng dụng.

C. Mức độ win
Dùng đánh giá thủ công:

- unreviewed: Chưa đánh giá.
- testing: Đang test.
- not_winning: Không win.
- promising: Có tiềm năng.
- winning: Win.
- scaling: Scale.

Hiển thị bằng badge có chữ và màu:

- Chưa đánh giá: xám.
- Đang test: xanh dương.
- Không win: đỏ nhẹ.
- Có tiềm năng: vàng/cam.
- Win: xanh lá.
- Scale: tím.

Không tự suy luận mức độ win từ dữ liệu.
Không tự chuyển Win sang Scale.
Có ghi chú để người dùng mô tả kết quả theo network/thị trường.
Mức độ win là đánh giá tổng thể của bản ghi trong MVP.

D. Tìm kiếm và lọc

- Tìm theo tên dự án, tên hoặc mã playable.
- Bộ lọc:
  - Dự án.
  - Trạng thái dự án.
  - Người phụ trách dự án.
  - Mức độ win.
  - Network.
- Kết hợp nhiều bộ lọc.
- Có nút xóa bộ lọc và số kết quả.
- Phân trang phía server, không tải toàn bộ kho về trình duyệt.
- Đồng bộ search/filter/page vào URL để có thể chia sẻ và giữ trạng thái khi quay lại.
- Mặc định không hiển thị dữ liệu đã lưu trữ; có chế độ xem riêng để khôi phục.

4. CÁC MÀN HÌNH

A. Đăng nhập

- Dùng Supabase Auth.
- Chỉ tài khoản được mời mới sử dụng được.
- Không có đăng ký công khai.
- Cung cấp hướng dẫn tạo/mời thành viên đầu tiên bằng Supabase Dashboard.
- Không xây module quản lý thành viên trong MVP.

B. Danh sách dự án

- Sidebar gọn: “Dự án”, “Kho playable”.
- Thanh search.
- Lọc trạng thái/người phụ trách.
- Nút “Tạo dự án”.
- Card hoặc bảng hiển thị:
  - Tên.
  - Người phụ trách.
  - Trạng thái.
  - Số playable.
  - Cập nhật gần nhất.
- Bấm dự án mở chi tiết.

C. Chi tiết dự án

- Tên, mô tả, người phụ trách, trạng thái.
- Nút chỉnh sửa.
- Danh sách playable thuộc dự án.
- Search, lọc mức độ win/network.
- Nút thêm playable, tự điền dự án hiện tại.

D. Kho playable toàn công ty

- Hiển thị playable từ tất cả dự án.
- Mặc định dạng bảng, có thumbnail nhỏ.
- Các cột:
  - Playable: mã + tên.
  - Dự án.
  - Người phụ trách dự án.
  - Network.
  - Mức độ win.
  - Ngày triển khai.
  - Cập nhật gần nhất.
  - Menu thao tác.
- Không cần dashboard biểu đồ hoặc chế độ grid trong MVP.

E. Chi tiết playable

- Mở bằng sheet/panel bên phải trên desktop.
- Trên mobile dùng sheet toàn màn hình.
- Hiển thị thumbnail, metadata, ghi chú, file/link.
- Cho cập nhật thông tin và mức độ win.
- Nút tải file, mở URL, tạo bản sao, lưu trữ.
- Mở trực tiếp được bằng URL và khôi phục danh sách/bộ lọc khi đóng panel.

5. UX/UI

- Giao diện tiếng Việt; tên network và thuật ngữ Win/Scale giữ nguyên.
- Phong cách công cụ nội bộ: sáng, gọn, rõ, dễ đọc.
- Nền xám nhạt, surface trắng, một màu nhấn chính.
- Ưu tiên bảng dữ liệu và thao tác nhanh.
- Responsive: desktop là chính, mobile vẫn dùng được.
- Không thêm gradient, biểu đồ hay trang trí không phục vụ công việc.
- Mọi icon thao tác có accessible name; nút chính có nhãn rõ.
- Có loading, empty, error, no-results và upload progress.
- Phân biệt “Chưa có dữ liệu” với “Không tìm thấy kết quả”.
- Có xác nhận trước khi lưu trữ.
- Báo lỗi tại trường nhập; giữ dữ liệu form nếu lưu thất bại.
- Không hiển thị thông báo thành công khi backend chưa lưu thành công.

6. DATABASE VÀ FILE

Tạo SQL migrations cho các bảng tối thiểu:

- profiles.
- projects.
- playables.
- networks.
- playable_networks.

Thiết kế khóa ngoại, unique constraint, enum/check constraint và index phù hợp.

Yêu cầu:

- profiles liên kết auth.users.
- projects có owner_id, status, archived_at, created_by, updated_by và timestamps.
- playables có project_id, code, win_level, storage path/URL, metadata file, thumbnail path, released_at, notes, archived_at và các trường audit.
- Lưu storage path, không lưu signed URL hết hạn vào database.
- Mã playable tạo an toàn khi nhiều người thêm đồng thời.
- created_by/updated_by lấy từ phiên đăng nhập được xác thực.
- Cập nhật metadata và quan hệ network trong một transaction khi cần để tránh lưu dở dang.

Supabase Storage:

- Bucket private cho build và thumbnail.
- Upload trực tiếp lên Storage sau khi xác thực, không proxy file qua Vercel Function.
- Tên object duy nhất, không overwrite.
- Download bằng URL có thời hạn sau khi kiểm tra phiên đăng nhập.
- Kiểm tra loại file và kích thước ở cả client và cấu hình/policy phù hợp.
- Giới hạn dung lượng là cấu hình của kho, không coi đó là tiêu chuẩn Pass/Fail của ad network.
- Dọn file mới upload nếu thao tác tạo bản ghi thất bại khi có thể.
- Không giải nén hoặc thực thi HTML/ZIP trong MVP.
- URL ngoài chỉ chấp nhận http/https.

7. AUTH VÀ QUYỀN TRUY CẬP

Không phân chia quyền nghiệp vụ, nhưng phải bảo vệ dữ liệu nội bộ:

- Tất cả thành viên được mời có cùng quyền cộng tác.
- Người chưa đăng nhập không truy cập dữ liệu hoặc file.
- Tắt public sign-up.
- Thiết lập RLS cho bảng dữ liệu và Storage.
- Không chỉ bảo vệ bằng cách ẩn nút trên frontend.
- Không đưa service-role/secret key vào frontend hoặc biến NEXT_PUBLIC.
- Không commit secret.
- Cung cấp .env.example và hướng dẫn cấu hình.
- Kiểm tra quyền truy cập ở server cho các thao tác cần thiết.

8. NGOÀI PHẠM VI MVP

Không triển khai:

- Board sản xuất/Kanban.
- Vai trò UA/Design.
- Giao task, deadline, approval workflow.
- Bình luận hoặc thông báo.
- Hệ thống version nâng cao.
- Preview HTML tương tác.
- Testing Unity/Mintegral hoặc validator tự động.
- Đồng bộ campaign/API network.
- Chỉ số quảng cáo, biểu đồ hiệu suất, tự tính mức độ win.
- Tính năng AI.

9. KIỂM TRA NGHIỆM THU

Kiểm tra các luồng quan trọng:

- Đăng nhập, đăng xuất; người chưa đăng nhập bị chặn.
- Tạo/sửa dự án, đổi owner và trạng thái.
- Thêm playable bằng file hoặc URL.
- Sửa mức độ win và ghi chú, reload vẫn giữ dữ liệu.
- Download đúng file đã lưu.
- Search và kết hợp bộ lọc, phân trang.
- Mở/đóng panel giữ đúng bộ lọc.
- Lưu trữ và khôi phục.
- Upload hoặc lưu database thất bại được xử lý rõ ràng.
- RLS ngăn truy cập ẩn danh; các thành viên có quyền cộng tác như nhau.
- Giao diện không vỡ ở desktop và mobile.
- Typecheck, lint và production build thành công.

Viết test có ý nghĩa cho validation và các luồng dữ liệu quan trọng.
Báo rõ kiểm tra nào đã chạy, kiểm tra nào chưa chạy vì thiếu kết nối/cấu hình.

10. QUY TRÌNH VÀ BÀN GIAO

- Trước khi code, nêu ngắn kế hoạch triển khai và giả định.
- Tiếp tục tự xử lý các quyết định nhỏ, không hỏi lại những lựa chọn đã được mô tả.
- Nếu thiếu credentials Supabase/Vercel, vẫn hoàn thành code, migrations, UI và kiểm tra có thể chạy; sau đó nêu đúng cấu hình còn thiếu.
- Không giả lập dữ liệu lưu thành công khi chưa kết nối Supabase.
- Nếu có demo data, chỉ dùng trong chế độ demo rõ ràng hoặc seed riêng; không tự đưa vào production.
- Chuẩn bị deploy trên Vercel, cấu hình Supabase Auth callback/redirect và biến môi trường.
- Chỉ xác nhận đã deploy khi có URL hoạt động và đã kiểm tra thực tế.

Bàn giao:

1. Source code hoàn chỉnh.
2. SQL migrations và cấu hình Storage/RLS.
3. .env.example.
4. README hướng dẫn local, Supabase và Vercel.
5. Hướng dẫn mời thành viên.
6. Kết quả kiểm tra, giới hạn còn lại và URL nếu đã deploy.

Bắt đầu bằng việc kiểm tra repository rồi triển khai MVP theo đúng phạm vi trên.
