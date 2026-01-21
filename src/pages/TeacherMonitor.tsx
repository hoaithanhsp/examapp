import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Clock, AlertTriangle, Download, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase, getSubmissionsByExam } from '../lib/supabase';
import type { Exam, Submission } from '../lib/supabase';
import * as XLSX from 'xlsx';

export function TeacherMonitor() {
    const { examId } = useParams<{ examId: string }>();
    const [exam, setExam] = useState<Exam | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);

    // Load exam and submissions
    useEffect(() => {
        async function loadData() {
            if (!examId) return;

            // Load exam
            const { data: examData } = await supabase
                .from('exams')
                .select('*')
                .eq('id', examId)
                .single();

            if (examData) setExam(examData as Exam);

            // Load submissions
            const subs = await getSubmissionsByExam(examId);
            setSubmissions(subs);
            setLoading(false);
        }
        loadData();
    }, [examId]);

    // Setup realtime subscription
    useEffect(() => {
        if (!examId) return;

        const channel = supabase
            .channel('submissions-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'submissions',
                    filter: `exam_id=eq.${examId}`
                },
                async () => {
                    // Reload submissions when changes occur
                    const subs = await getSubmissionsByExam(examId);
                    setSubmissions(subs);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [examId]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const exportToExcel = () => {
        if (!exam) return;

        const data = submissions.map((sub) => ({
            'Tên học sinh': sub.student_name,
            'Trạng thái': sub.status === 'submitted' ? 'Đã nộp' : 'Đang làm',
            'Điểm': sub.score,
            'Tổng câu': sub.total_questions,
            'Số lần thoát': sub.exit_count,
            'Thời gian làm': formatTime(sub.time_spent),
            'Bắt đầu': new Date(sub.started_at).toLocaleString('vi-VN'),
            'Nộp bài': sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('vi-VN') : '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Kết quả');
        XLSX.writeFile(wb, `${exam.title}_ketqua.xlsx`);
    };

    const refreshData = async () => {
        if (!examId) return;
        setLoading(true);
        const subs = await getSubmissionsByExam(examId);
        setSubmissions(subs);
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="page flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="page">
                <div className="container text-center">
                    <h2>Không tìm thấy đề thi</h2>
                    <Link to="/teacher" className="btn btn-primary mt-4">
                        <ArrowLeft size={18} />
                        Quay lại
                    </Link>
                </div>
            </div>
        );
    }

    const inProgressCount = submissions.filter(s => s.status === 'in_progress').length;
    const submittedCount = submissions.filter(s => s.status === 'submitted').length;
    const avgScore = submittedCount > 0
        ? Math.round(submissions.filter(s => s.status === 'submitted').reduce((acc, s) => acc + s.score, 0) / submittedCount)
        : 0;

    return (
        <div className="page">
            <div className="container">
                {/* Header */}
                <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <Link to="/teacher" className="text-muted text-sm flex items-center gap-1 mb-2">
                            <ArrowLeft size={16} />
                            Quay lại Dashboard
                        </Link>
                        <h1>{exam.title}</h1>
                        <p className="text-muted">
                            Mã phòng: <span className="font-bold" style={{ color: 'var(--primary-light)' }}>{exam.room_code}</span>
                            {' • '}{exam.questions.length} câu hỏi
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-outline" onClick={refreshData}>
                            <RefreshCw size={18} />
                            Làm mới
                        </button>
                        <button className="btn btn-primary" onClick={exportToExcel} disabled={submissions.length === 0}>
                            <Download size={18} />
                            Xuất Excel
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card text-center">
                        <Users size={32} style={{ color: 'var(--primary)' }} />
                        <p className="text-3xl font-bold mt-2">{submissions.length}</p>
                        <p className="text-muted">Tổng học sinh</p>
                    </div>
                    <div className="card text-center">
                        <Clock size={32} style={{ color: 'var(--warning)' }} />
                        <p className="text-3xl font-bold mt-2">{inProgressCount}</p>
                        <p className="text-muted">Đang làm bài</p>
                    </div>
                    <div className="card text-center">
                        <Download size={32} style={{ color: 'var(--success)' }} />
                        <p className="text-3xl font-bold mt-2">{submittedCount}</p>
                        <p className="text-muted">Đã nộp bài</p>
                    </div>
                    <div className="card text-center">
                        <AlertTriangle size={32} style={{ color: 'var(--danger)' }} />
                        <p className="text-3xl font-bold mt-2">{avgScore}%</p>
                        <p className="text-muted">Điểm trung bình</p>
                    </div>
                </div>

                {/* Submissions Table */}
                <div className="card">
                    <h3 className="mb-4">Danh sách học sinh</h3>

                    {submissions.length === 0 ? (
                        <p className="text-center text-muted p-6">
                            Chưa có học sinh nào vào phòng thi.<br />
                            Chia sẻ mã phòng <span className="font-bold">{exam.room_code}</span> cho học sinh.
                        </p>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Học sinh</th>
                                        <th>Trạng thái</th>
                                        <th>Câu hiện tại</th>
                                        <th>Điểm</th>
                                        <th>Thoát màn hình</th>
                                        <th>Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((sub) => (
                                        <tr key={sub.id}>
                                            <td className="font-bold">{sub.student_name}</td>
                                            <td>
                                                <span className={`badge ${sub.status === 'submitted' ? 'badge-success' : 'badge-warning'}`}>
                                                    {sub.status === 'submitted' ? 'Đã nộp' : 'Đang làm'}
                                                </span>
                                            </td>
                                            <td>
                                                {sub.status === 'in_progress'
                                                    ? `${sub.current_question + 1}/${exam.questions.length}`
                                                    : '-'
                                                }
                                            </td>
                                            <td>
                                                {sub.status === 'submitted'
                                                    ? <span className="font-bold">{sub.score}/{sub.total_questions}</span>
                                                    : '-'
                                                }
                                            </td>
                                            <td>
                                                {sub.exit_count > 0 ? (
                                                    <span className="badge badge-danger">
                                                        <AlertTriangle size={14} />
                                                        {sub.exit_count}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">0</span>
                                                )}
                                            </td>
                                            <td className="text-muted">{formatTime(sub.time_spent)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
