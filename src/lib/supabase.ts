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

export interface Submission {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
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
