import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, User, Key, Hash, Lock, CheckCircle } from 'lucide-react';
import { getExamByRoomCode, createStudent, createSubmission, hasClassList, findClassStudent } from '../lib/supabase';
import type { Exam } from '../lib/supabase';

export function StudentLogin() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exam, setExam] = useState<Exam | null>(null);

    // State cho mode đăng nhập
    const [hasClass, setHasClass] = useState(false);
    const [checkingRoom, setCheckingRoom] = useState(false);

    // Thông tin học sinh - mode thường
    const [studentName, setStudentName] = useState('');

    // Thông tin học sinh - mode có danh sách lớp
    const [studentCode, setStudentCode] = useState('');
    const [password, setPassword] = useState('');

    // Thông tin học sinh được nhận diện
    const [identifiedStudent, setIdentifiedStudent] = useState<{
        full_name: string;
        birth_date: string;
        class_name: string;
    } | null>(null);

    // Kiểm tra phòng thi và xem có danh sách lớp không
    const checkRoom = async () => {
        if (roomCode.length < 4) return;

        setCheckingRoom(true);
        setError('');
        setExam(null);
        setHasClass(false);
        setIdentifiedStudent(null);

        try {
            const foundExam = await getExamByRoomCode(roomCode.toUpperCase());
            if (foundExam) {
                setExam(foundExam);
                if (!foundExam.is_active) {
                    setError('Phòng thi này đã đóng');
                } else {
                    // Kiểm tra có danh sách lớp không
                    const hasList = await hasClassList(foundExam.id);
                    setHasClass(hasList);
                }
            } else {
                setError('Không tìm thấy phòng thi');
            }
        } catch (err) {
            setError('Lỗi khi kiểm tra phòng thi');
        } finally {
            setCheckingRoom(false);
        }
    };

    // Tự động kiểm tra khi nhập mã phòng
    useEffect(() => {
        const timer = setTimeout(() => {
            if (roomCode.length >= 4) {
                checkRoom();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [roomCode]);

    // Xác thực học sinh với mã + mật khẩu
    const verifyStudent = async () => {
        if (!exam || !studentCode.trim() || !password.trim()) return;

        setError('');
        const student = await findClassStudent(exam.id, studentCode.trim(), password.trim());

        if (student) {
            setIdentifiedStudent({
                full_name: student.full_name,
                birth_date: student.birth_date,
                class_name: student.class_name
            });
            setError('');
        } else {
            setIdentifiedStudent(null);
            setError('Mã số hoặc mật khẩu không đúng');
        }
    };

    // Kiểm tra khi thay đổi mã hoặc mật khẩu
    useEffect(() => {
        if (hasClass && studentCode && password) {
            const timer = setTimeout(() => {
                verifyStudent();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [studentCode, password, hasClass, exam]);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!exam) {
            setError('Vui lòng nhập mã phòng thi hợp lệ');
            return;
        }

        if (!exam.is_active) {
            setError('Phòng thi này đã đóng');
            return;
        }

        // Validate dựa theo mode
        if (hasClass) {
            if (!identifiedStudent) {
                setError('Vui lòng nhập đúng Mã số học sinh và Mật khẩu');
                return;
            }
        } else {
            if (!studentName.trim()) {
                setError('Vui lòng nhập tên của bạn');
                return;
            }
        }

        setLoading(true);
        setError('');

        try {
            // Xác định tên học sinh
            const finalStudentName = hasClass ? identifiedStudent!.full_name : studentName.trim();

            // Create student
            const student = await createStudent(finalStudentName);
            if (!student) {
                setError('Không thể tạo thông tin học sinh');
                setLoading(false);
                return;
            }

            // Create submission với thông tin đầy đủ
            const submissionData: any = {
                exam_id: exam.id,
                student_id: student.id,
                student_name: finalStudentName,
                answers: {},
                score: 0,
                total_questions: exam.questions.length,
                exit_count: 0,
                time_spent: 0,
                status: 'in_progress',
                current_question: 0
            };

            // Thêm thông tin từ danh sách lớp nếu có
            if (hasClass && identifiedStudent) {
                submissionData.student_code = studentCode.toUpperCase();
                submissionData.birth_date = identifiedStudent.birth_date;
                submissionData.class_name = identifiedStudent.class_name;
            }

            const submission = await createSubmission(submissionData);

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
                    <p className="text-muted">Nhập mã phòng để bắt đầu</p>
                </div>

                <form onSubmit={handleJoin}>
                    {/* Mã phòng thi */}
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
                        {checkingRoom && (
                            <p className="text-sm text-muted" style={{ textAlign: 'center' }}>
                                Đang kiểm tra...
                            </p>
                        )}
                        {exam && exam.is_active && (
                            <p className="text-sm" style={{ textAlign: 'center', color: 'var(--success)' }}>
                                ✓ {exam.title} ({exam.questions.length} câu)
                            </p>
                        )}
                    </div>

                    {/* Hiển thị form phù hợp */}
                    {exam && exam.is_active && (
                        <>
                            {hasClass ? (
                                // MODE: Đăng nhập bằng Mã số + Mật khẩu
                                <>
                                    <div className="alert alert-success mb-4" style={{ padding: '0.75rem' }}>
                                        <CheckCircle size={16} />
                                        <span className="text-sm">Phòng thi này có danh sách lớp - Nhập Mã số và Mật khẩu</span>
                                    </div>

                                    <div className="input-group">
                                        <label className="flex items-center gap-2">
                                            <Hash size={16} />
                                            Mã số học sinh
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="VD: HS01"
                                            value={studentCode}
                                            onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="flex items-center gap-2">
                                            <Lock size={16} />
                                            Mật khẩu
                                        </label>
                                        <input
                                            type="password"
                                            className="input"
                                            placeholder="Nhập mật khẩu..."
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>

                                    {/* Hiển thị thông tin đã nhận diện */}
                                    {identifiedStudent && (
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.1))',
                                            border: '1px solid rgba(34, 197, 94, 0.4)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '1rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <p style={{ fontWeight: 'bold', color: 'var(--success)', marginBottom: '0.5rem' }}>
                                                ✓ Xin chào, {identifiedStudent.full_name}!
                                            </p>
                                            <p className="text-sm text-muted">
                                                Ngày sinh: {identifiedStudent.birth_date} • Lớp: {identifiedStudent.class_name}
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // MODE: Nhập tên tự do
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
                            )}
                        </>
                    )}

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
                        disabled={loading || !exam || !exam.is_active || (hasClass && !identifiedStudent) || (!hasClass && !studentName.trim())}
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
