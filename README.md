# ExamApp - Ứng Dụng Thi Trực Tuyến

Ứng dụng thi trực tuyến với AI phân tích đề thi, theo dõi realtime, và chống gian lận.

## 🚀 Tính năng

- **Upload PDF**: Upload đề thi PDF, AI tự động phân tích và tạo câu hỏi
- **Mã phòng thi**: Tự động tạo mã 6 ký tự để học sinh vào thi
- **Theo dõi Realtime**: Xem học sinh làm bài trực tiếp
- **Chống gian lận**: Phát hiện khi học sinh thoát màn hình
- **Chấm điểm tự động**: Tính điểm ngay khi nộp bài
- **Xuất Excel**: Export kết quả thi

## 📋 Yêu cầu

- Node.js 18+
- Tài khoản Supabase (miễn phí)
- Gemini API Key (miễn phí)

## 🛠️ Cài đặt

### 1. Clone và cài đặt dependencies

```bash
cd ExamApp
npm install
```

### 2. Setup Supabase Database

1. Vào https://supabase.com và đăng nhập
2. Mở SQL Editor trong dự án Supabase của bạn
3. Copy nội dung file `supabase_setup.sql` và paste vào SQL Editor
4. Nhấn **Run** để tạo bảng

**Thông tin Supabase đã được cấu hình sẵn trong app:**
- URL: `https://labpnvnfogvspsvpsbpm.supabase.co`
- API Key: Đã được tích hợp

### 3. Bật Realtime (Quan trọng!)

1. Vào Supabase Dashboard → Database → Replication
2. Bật toggle "Enabled" cho bảng `submissions`

### 4. Chạy ứng dụng

```bash
npm run dev
```

Mở http://localhost:5173

## 📖 Hướng dẫn sử dụng

### Giáo viên

1. Vào **Cài đặt** → Nhập **Gemini API Key** (lấy tại https://aistudio.google.com/app/apikey)
2. Vào **Giáo viên** → Upload file PDF đề thi
3. Đợi AI phân tích → Nhận **Mã phòng thi**
4. Chia sẻ mã cho học sinh
5. Vào **Theo dõi** để xem học sinh làm bài realtime

### Học sinh

1. Vào **Học sinh**
2. Nhập **Mã phòng thi** và **Họ tên**
3. Làm bài thi
4. Nộp bài và xem kết quả

## 🔧 Cấu trúc dự án

```
ExamApp/
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── geminiService.ts # Gemini AI service
│   │   └── pdfParser.ts     # PDF text extraction
│   ├── pages/
│   │   ├── Home.tsx         # Trang chủ
│   │   ├── Settings.tsx     # Cài đặt API Key
│   │   ├── TeacherDashboard.tsx  # Upload đề thi
│   │   ├── TeacherMonitor.tsx    # Theo dõi realtime
│   │   ├── StudentLogin.tsx      # Đăng nhập học sinh
│   │   ├── StudentExam.tsx       # Làm bài thi
│   │   └── StudentResult.tsx     # Kết quả
│   ├── App.tsx
│   └── index.css
├── supabase_setup.sql       # SQL tạo database
└── package.json
```

## 🔑 API Keys

### Gemini API Key (bắt buộc)
1. Truy cập https://aistudio.google.com/app/apikey
2. Đăng nhập Google
3. Tạo API Key mới
4. Paste vào phần **Cài đặt** trong app

## 🐛 Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-------------|----------------|
| 404 khi load exams | Chưa tạo bảng database | Chạy `supabase_setup.sql` |
| Không parse được PDF | File là ảnh scan | Dùng OCR chuyển sang text |
| AI không hoạt động | Thiếu API Key | Vào Cài đặt nhập key |
| Realtime không cập nhật | Chưa bật Replication | Bật trong Supabase Dashboard |

## 📝 Deploy lên Vercel

```bash
npm run build
```

1. Push code lên GitHub
2. Truy cập https://vercel.com
3. Import repository
4. Deploy!

## 📄 License

MIT
