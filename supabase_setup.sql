-- =====================================================
-- SUPABASE DATABASE SETUP FOR EXAM APP
-- Chạy script này trong Supabase SQL Editor
-- =====================================================

-- Bật extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. BẢNG TEACHERS (Giáo viên)
-- =====================================================
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. BẢNG EXAMS (Đề thi)
-- =====================================================
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    room_code TEXT UNIQUE NOT NULL,
    pdf_url TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_limit INTEGER DEFAULT 60, -- Giới hạn thời gian (phút)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. BẢNG STUDENTS (Học sinh)
-- =====================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    student_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. BẢNG SUBMISSIONS (Bài làm)
-- =====================================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    exit_count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- Thời gian làm bài (giây)
    status TEXT DEFAULT 'in_progress', -- in_progress, submitted
    current_question INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ
);

-- =====================================================
-- INDEXES để tối ưu tốc độ truy vấn
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_exams_room_code ON exams(room_code);
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Bật RLS cho tất cả bảng
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Xóa policies cũ nếu có (để tránh lỗi khi chạy lại script)
DROP POLICY IF EXISTS "Allow all for teachers" ON teachers;
DROP POLICY IF EXISTS "Allow read exams for all" ON exams;
DROP POLICY IF EXISTS "Allow write exams for all" ON exams;
DROP POLICY IF EXISTS "Allow all for students" ON students;
DROP POLICY IF EXISTS "Allow read submissions for all" ON submissions;
DROP POLICY IF EXISTS "Allow write submissions for all" ON submissions;

-- Policy cho TEACHERS
-- Cho phép tất cả đọc (vì app demo, không có auth phức tạp)
CREATE POLICY "Allow all for teachers" ON teachers
    FOR ALL USING (true) WITH CHECK (true);

-- Policy cho EXAMS
-- Cho phép đọc tất cả (học sinh cần xem đề)
CREATE POLICY "Allow read exams for all" ON exams
    FOR SELECT USING (true);

-- Cho phép insert/update/delete cho tất cả (demo mode)
CREATE POLICY "Allow write exams for all" ON exams
    FOR ALL USING (true) WITH CHECK (true);

-- Policy cho STUDENTS
CREATE POLICY "Allow all for students" ON students
    FOR ALL USING (true) WITH CHECK (true);

-- Policy cho SUBMISSIONS
-- Cho phép đọc tất cả (giáo viên cần xem)
CREATE POLICY "Allow read submissions for all" ON submissions
    FOR SELECT USING (true);

-- Cho phép insert/update cho tất cả
CREATE POLICY "Allow write submissions for all" ON submissions
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ENABLE REALTIME cho bảng submissions
-- (Để giáo viên thấy cập nhật realtime)
-- =====================================================
-- Chạy riêng trong Supabase Dashboard > Database > Replication
-- Bật toggle cho bảng "submissions"

-- =====================================================
-- DỮ LIỆU MẪU (Test Data)
-- =====================================================
INSERT INTO teachers (email, name) VALUES 
    ('teacher@example.com', 'Thầy Giáo Test')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- HOÀN TẤT!
-- =====================================================
-- Sau khi chạy script này:
-- 1. Kiểm tra Table Editor có 4 bảng
-- 2. Vào Database > Replication > Bật realtime cho submissions
-- 3. Kiểm tra Authentication > Policies xem RLS đã hoạt động
