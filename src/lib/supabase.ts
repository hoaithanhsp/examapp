import { createClient } from '@supabase/supabase-js';

// Supabase credentials - đã được cung cấp sẵn
const supabaseUrl = 'https://labpnvnfogvspsvpsbpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYnBudm5mb2d2c3BzdnBzYnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NDYyMjksImV4cCI6MjA4NDUyMjIyOX0.X539ZMI97pGmgZ34IWeQur-mJu0k4MAR5G8RyuJl46U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types cho database
export interface Teacher {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Question {
  id: number;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correct_answer: string | string[];
  sub_questions?: { content: string; answer: string }[];
  // Hỗ trợ câu hỏi có hình ảnh
  has_image?: boolean;
  image_description?: string;
  image_url?: string;
}

export interface Exam {
  id: string;
  teacher_id: string | null;
  title: string;
  room_code: string;
  pdf_url: string | null;
  questions: Question[];
  time_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  student_code: string | null;
  created_at: string;
}

// Interface cho học sinh trong danh sách lớp (từ file Excel)
export interface ClassStudent {
  id?: string;
  exam_id: string;
  student_code: string;    // Mã số học sinh (VD: HS01)
  password: string;        // Mật khẩu
  full_name: string;       // Họ và tên
  birth_date: string;      // Ngày sinh (VD: 20/03/2010)
  class_name: string;      // Lớp (VD: 10A)
  created_at?: string;
}

export interface Submission {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
  student_code?: string;    // Mã số HS (từ danh sách lớp)
  birth_date?: string;      // Ngày sinh (từ danh sách lớp)
  class_name?: string;      // Lớp (từ danh sách lớp)
  answers: Record<number, string | string[]>;
  score: number;
  total_questions: number;
  exit_count: number;
  time_spent: number;
  status: 'in_progress' | 'submitted';
  current_question: number;
  started_at: string;
  submitted_at: string | null;
}

// Helper functions
export async function getExamByRoomCode(roomCode: string): Promise<Exam | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (error) {
    console.error('Error fetching exam:', error);
    return null;
  }
  return data as Exam;
}

export async function createExam(exam: Partial<Exam>): Promise<Exam | null> {
  const { data, error } = await supabase
    .from('exams')
    .insert([exam])
    .select()
    .single();

  if (error) {
    console.error('Error creating exam:', error);
    return null;
  }
  return data as Exam;
}

export async function createStudent(name: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('students')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    console.error('Error creating student:', error);
    return null;
  }
  return data as Student;
}

export async function createSubmission(submission: Partial<Submission>): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .insert([submission])
    .select()
    .single();

  if (error) {
    console.error('Error creating submission:', error);
    return null;
  }
  return data as Submission;
}

export async function updateSubmission(id: string, updates: Partial<Submission>): Promise<boolean> {
  const { error } = await supabase
    .from('submissions')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating submission:', error);
    return false;
  }
  return true;
}

export async function getSubmissionsByExam(examId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('exam_id', examId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
  return data as Submission[];
}

// Tạo room code ngẫu nhiên
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Upload ảnh câu hỏi lên Supabase Storage
export async function uploadQuestionImage(
  file: File,
  examId: string,
  questionNumber: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Tạo tên file unique
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${examId}/q${questionNumber}_${Date.now()}.${fileExt}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Lấy public URL
    const { data: urlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(fileName);

    return { success: true, url: urlData.publicUrl };

  } catch (err: any) {
    console.error('Upload exception:', err);
    return { success: false, error: err.message };
  }
}

// ============ QUẢN LÝ DANH SÁCH LỚP TỪ EXCEL ============

// Lưu danh sách học sinh từ file Excel
export async function saveClassStudents(
  examId: string,
  students: Omit<ClassStudent, 'id' | 'exam_id' | 'created_at'>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Xóa danh sách cũ trước (nếu có)
    await supabase
      .from('class_students')
      .delete()
      .eq('exam_id', examId);

    // Thêm danh sách mới
    const studentsWithExamId = students.map(s => ({
      ...s,
      exam_id: examId
    }));

    const { error } = await supabase
      .from('class_students')
      .insert(studentsWithExamId);

    if (error) {
      console.error('Error saving class students:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Save class students exception:', err);
    return { success: false, error: err.message };
  }
}

// Tìm học sinh theo Mã số + Mật khẩu trong danh sách lớp của phòng thi
export async function findClassStudent(
  examId: string,
  studentCode: string,
  password: string
): Promise<ClassStudent | null> {
  const { data, error } = await supabase
    .from('class_students')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_code', studentCode.toUpperCase())
    .eq('password', password)
    .single();

  if (error) {
    console.error('Error finding class student:', error);
    return null;
  }

  return data as ClassStudent;
}

// Kiểm tra phòng thi có danh sách lớp không
export async function hasClassList(examId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('class_students')
    .select('*', { count: 'exact', head: true })
    .eq('exam_id', examId);

  if (error) {
    console.error('Error checking class list:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

// Lấy danh sách học sinh của một phòng thi
export async function getClassStudents(examId: string): Promise<ClassStudent[]> {
  const { data, error } = await supabase
    .from('class_students')
    .select('*')
    .eq('exam_id', examId)
    .order('student_code', { ascending: true });

  if (error) {
    console.error('Error fetching class students:', error);
    return [];
  }

  return data as ClassStudent[];
}

