import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, User, Key } from 'lucide-react';
import { getExamByRoomCode, createStudent, createSubmission } from '../lib/supabase';

export function StudentLogin() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState('');
    const [studentName, setStudentName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!roomCode.trim()) {
            setError('Vui lòng nhập mã phòng thi');
            return;
        }

        if (!studentName.trim()) {
            setError('Vui lòng nhập tên của bạn');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Find exam by room code
            const exam = await getExamByRoomCode(roomCode.toUpperCase());

            if (!exam) {
                setError('Không tìm thấy phòng thi. Kiểm tra lại mã phòng.');
                setLoading(false);
                return;
            }

            if (!exam.is_active) {
                setError('Phòng thi này đã đóng');
                setLoading(false);
                return;
            }

            // Create student
            const student = await createStudent(studentName.trim());
            if (!student) {
                setError('Không thể tạo thông tin học sinh');
                setLoading(false);
                return;
            }

            // Create submission
            const submission = await createSubmission({
                exam_id: exam.id,
                student_id: student.id,
                student_name: studentName.trim(),
                answers: {},
                score: 0,
                total_questions: exam.questions.length,
                exit_count: 0,
                time_spent: 0,
                status: 'in_progress',
                current_question: 0
            });

            if (!submission) {
                setError('Không thể bắt đầu bài thi');
                setLoading(false);
                return;
            }

            // Save to localStorage for exam page
            localStorage.setItem('currentExam', JSON.stringify(exam));
            localStorage.setItem('currentSubmission', JSON.stringify(submission));

            // Navigate to exam
            navigate(`/student/exam/${submission.id}`);

        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '450px' }}>
                <div className="text-center mb-6">
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--secondary), var(--secondary-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <LogIn size={40} />
                    </div>
                    <h2>Vào Phòng Thi</h2>
                    <p className="text-muted">Nhập mã phòng và tên để bắt đầu</p>
                </div>

                <form onSubmit={handleJoin}>
                    <div className="input-group">
                        <label className="flex items-center gap-2">
                            <Key size={16} />
                            Mã phòng thi
                        </label>
                        <input
                            type="text"
                            className="input input-lg"
                            placeholder="VD: ABC123"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                            style={{
                                textAlign: 'center',
                                letterSpacing: '0.2em',
                                fontWeight: 'bold',
                                fontSize: '1.5rem'
                            }}
                        />
                    </div>

                    <div className="input-group">
                        <label className="flex items-center gap-2">
                            <User size={16} />
                            Tên của bạn
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Nhập họ và tên..."
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="alert alert-danger">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-secondary btn-lg"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner" style={{ width: '20px', height: '20px' }} />
                                Đang vào phòng...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Vào Phòng Thi
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <p className="text-sm text-muted">
                        Hãy nhập chính xác mã phòng mà giáo viên đã cung cấp
                    </p>
                </div>
            </div>
        </div>
    );
}
