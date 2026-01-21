import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, FileText, Check, AlertCircle, Eye, Loader2 } from 'lucide-react';
import { extractTextFromPDF, isPDFFile } from '../lib/pdfParser';
import { analyzeExamText } from '../lib/geminiService';
import { createExam, generateRoomCode, supabase } from '../lib/supabase';
import type { Exam } from '../lib/supabase';
import { hasApiKey } from '../lib/geminiService';

export function TeacherDashboard() {
    const navigate = useNavigate();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [error, setError] = useState('');
    const [createdExam, setCreatedExam] = useState<Exam | null>(null);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loadingExams, setLoadingExams] = useState(true);

    // Load existing exams
    useState(() => {
        async function loadExams() {
            const { data } = await supabase
                .from('exams')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (data) setExams(data as Exam[]);
            setLoadingExams(false);
        }
        loadExams();
    });

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && isPDFFile(droppedFile)) {
            setFile(droppedFile);
            setError('');
        } else {
            setError('Vui lòng chọn file PDF');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && isPDFFile(selectedFile)) {
            setFile(selectedFile);
            setError('');
        } else {
            setError('Vui lòng chọn file PDF');
        }
    };

    const processExam = async () => {
        if (!file) return;

        if (!hasApiKey()) {
            setError('Vui lòng nhập API Key trong phần Cài đặt trước');
            return;
        }

        setProcessing(true);
        setProgress(0);
        setError('');
        setCreatedExam(null);

        try {
            // Step 1: Extract text
            setProgressText('Đang đọc file PDF...');
            setProgress(20);

            const pdfResult = await extractTextFromPDF(file);
            if (!pdfResult.success || !pdfResult.text) {
                throw new Error(pdfResult.error || 'Không thể đọc file PDF');
            }

            // Step 2: Analyze with AI
            setProgressText('AI đang phân tích đề thi...');
            setProgress(50);

            const analyzeResult = await analyzeExamText(pdfResult.text);
            if (!analyzeResult.success || !analyzeResult.questions) {
                throw new Error(analyzeResult.error || 'Không thể phân tích đề thi');
            }

            // Step 3: Create exam in database
            setProgressText('Đang tạo phòng thi...');
            setProgress(80);

            const roomCode = generateRoomCode();
            const exam = await createExam({
                title: analyzeResult.title || file.name.replace('.pdf', ''),
                room_code: roomCode,
                questions: analyzeResult.questions,
                time_limit: 60
            });

            if (!exam) {
                throw new Error('Không thể tạo phòng thi. Kiểm tra kết nối database.');
            }

            setProgress(100);
            setProgressText('Hoàn tất!');
            setCreatedExam(exam);
            setExams(prev => [exam, ...prev]);
            setFile(null);

        } catch (err: any) {
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setProcessing(false);
        }
    };

    const copyRoomCode = (code: string) => {
        navigator.clipboard.writeText(code);
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Dashboard Giáo viên</h1>
                    <p>Upload đề thi PDF và tạo phòng thi trực tuyến</p>
                </div>

                {!hasApiKey() && (
                    <div className="alert alert-warning mb-4">
                        <AlertCircle size={20} />
                        <span>
                            Bạn cần <Link to="/settings" style={{ fontWeight: 'bold' }}>nhập API Key</Link> để sử dụng tính năng phân tích PDF
                        </span>
                    </div>
                )}

                <div className="grid grid-2">
                    {/* Upload Section */}
                    <div className="card">
                        <h3 className="mb-4">Upload Đề Thi</h3>

                        {createdExam ? (
                            <div className="text-center">
                                <div className="alert alert-success mb-4">
                                    <Check size={20} />
                                    <span>Tạo phòng thi thành công! {createdExam.questions.length} câu hỏi</span>
                                </div>

                                <p className="text-muted mb-2">Mã phòng thi:</p>
                                <div
                                    className="room-code"
                                    onClick={() => copyRoomCode(createdExam.room_code)}
                                    title="Click để copy"
                                >
                                    {createdExam.room_code}
                                </div>
                                <p className="text-sm text-muted mt-2">Click để copy</p>

                                <div className="flex gap-4 justify-center mt-6">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => navigate(`/teacher/monitor/${createdExam.id}`)}
                                    >
                                        <Eye size={18} />
                                        Theo dõi
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => setCreatedExam(null)}
                                    >
                                        Tạo đề mới
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div
                                    className={`upload-area ${isDragging ? 'dragging' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('file-input')?.click()}
                                >
                                    <input
                                        type="file"
                                        id="file-input"
                                        accept=".pdf"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />

                                    {file ? (
                                        <>
                                            <FileText size={64} className="upload-area-icon" style={{ color: 'var(--primary)' }} />
                                            <p className="font-bold">{file.name}</p>
                                            <p className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={64} className="upload-area-icon" />
                                            <p className="font-bold">Kéo thả file PDF vào đây</p>
                                            <p className="text-muted">hoặc click để chọn file</p>
                                        </>
                                    )}
                                </div>

                                {processing && (
                                    <div className="mt-4">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm text-muted">{progressText}</span>
                                            <span className="text-sm text-muted">{progress}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="alert alert-danger mt-4">
                                        <AlertCircle size={20} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg mt-4"
                                    style={{ width: '100%' }}
                                    onClick={processExam}
                                    disabled={!file || processing}
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 size={20} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                                            Đang xử lý...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={20} />
                                            Tạo đề thi
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Recent Exams */}
                    <div className="card">
                        <h3 className="mb-4">Đề thi gần đây</h3>

                        {loadingExams ? (
                            <div className="text-center p-4">
                                <div className="spinner" style={{ margin: '0 auto' }} />
                            </div>
                        ) : exams.length === 0 ? (
                            <p className="text-muted text-center p-4">
                                Chưa có đề thi nào. Upload PDF để bắt đầu!
                            </p>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {exams.map((exam) => (
                                    <div
                                        key={exam.id}
                                        className="flex justify-between items-center p-4"
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: '0.5rem'
                                        }}
                                    >
                                        <div>
                                            <p className="font-bold">{exam.title}</p>
                                            <p className="text-sm text-muted">
                                                {exam.questions.length} câu • Mã: {exam.room_code}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={() => copyRoomCode(exam.room_code)}
                                            >
                                                Copy
                                            </button>
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => navigate(`/teacher/monitor/${exam.id}`)}
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
