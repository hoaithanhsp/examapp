import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, FileText, Check, AlertCircle, Eye, Loader2, Trash2, Image, Plus, X } from 'lucide-react';
import { extractTextFromPDF, isPDFFile } from '../lib/pdfParser';
import { extractFromWord, isWordFile } from '../lib/wordParser';
import { analyzeExamWithVision, analyzeExamText, hasApiKey } from '../lib/geminiService';
import { createExam, generateRoomCode, supabase } from '../lib/supabase';
import type { Exam } from '../lib/supabase';

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

    // State cho form nhập link ảnh
    const [imageInputs, setImageInputs] = useState<{ questionNumber: string, imageUrl: string, description: string }[]>([]);
    const [savingImages, setSavingImages] = useState(false);

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

    // Kiểm tra file hợp lệ (PDF hoặc Word)
    const isValidFile = (f: File) => isPDFFile(f) || isWordFile(f);

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
        if (droppedFile && isValidFile(droppedFile)) {
            setFile(droppedFile);
            setError('');
        } else {
            setError('Vui lòng chọn file PDF hoặc Word (.docx)');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && isValidFile(selectedFile)) {
            setFile(selectedFile);
            setError('');
        } else {
            setError('Vui lòng chọn file PDF hoặc Word (.docx)');
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
            let analyzeResult;
            const isWord = isWordFile(file);

            if (isWord) {
                // === XỬ LÝ FILE WORD ===
                setProgressText('Đang đọc file Word...');
                setProgress(15);

                const wordResult = await extractFromWord(file);
                if (!wordResult.success) {
                    throw new Error(wordResult.error || 'Không thể đọc file Word');
                }

                setProgress(30);

                // Nếu Word có hình ảnh, dùng HTML để phân tích
                if (wordResult.images && wordResult.images.length > 0) {
                    setProgressText(`AI Vision đang phân tích ${wordResult.images.length} hình ảnh...`);
                    setProgress(50);

                    // Gửi hình ảnh từ Word đến Gemini Vision
                    const imageBase64s = wordResult.images.map(img =>
                        `data:${img.contentType};base64,${img.base64}`
                    );
                    analyzeResult = await analyzeExamWithVision(imageBase64s);
                } else if (wordResult.html || wordResult.text) {
                    setProgressText('AI đang phân tích nội dung Word...');
                    setProgress(50);

                    // Dùng text để phân tích
                    analyzeResult = await analyzeExamText(wordResult.text || '');
                } else {
                    throw new Error('File Word không có nội dung');
                }

            } else {
                // === XỬ LÝ FILE PDF ===
                setProgressText('Đang đọc và chuyển PDF thành ảnh...');
                setProgress(15);

                const pdfResult = await extractTextFromPDF(file);
                if (!pdfResult.success) {
                    throw new Error(pdfResult.error || 'Không thể đọc file PDF');
                }

                setProgress(30);

                if (pdfResult.pageImages && pdfResult.pageImages.length > 0) {
                    setProgressText(`AI Vision đang phân tích ${pdfResult.pageImages.length} trang...`);
                    setProgress(50);
                    analyzeResult = await analyzeExamWithVision(pdfResult.pageImages);
                } else if (pdfResult.text) {
                    setProgressText('AI đang phân tích văn bản đề thi...');
                    setProgress(50);
                    analyzeResult = await analyzeExamText(pdfResult.text);
                } else {
                    throw new Error('Không thể trích xuất nội dung từ PDF');
                }
            }

            if (!analyzeResult.success || !analyzeResult.questions) {
                throw new Error(analyzeResult.error || 'Không thể phân tích đề thi');
            }

            // Step 3: Create exam in database
            setProgressText('Đang tạo phòng thi...');
            setProgress(80);

            const roomCode = generateRoomCode();
            const fileExtension = isWord ? '.docx' : '.pdf';
            const exam = await createExam({
                title: analyzeResult.title || file.name.replace(fileExtension, ''),
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
            setProgress(0);
            setProgressText('Đã dừng do lỗi');
        } finally {
            setProcessing(false);
        }
    };

    const copyRoomCode = (code: string) => {
        navigator.clipboard.writeText(code);
    };

    const deleteExam = async (examId: string, examTitle: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${examTitle}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('exams')
                .delete()
                .eq('id', examId);

            if (error) {
                setError('Không thể xóa đề thi: ' + error.message);
                return;
            }

            // Cập nhật danh sách exams
            setExams(prev => prev.filter(e => e.id !== examId));
        } catch (err: any) {
            setError('Có lỗi khi xóa đề thi: ' + err.message);
        }
    };

    // Thêm một dòng nhập ảnh mới
    const addImageInput = () => {
        setImageInputs(prev => [...prev, { questionNumber: '', imageUrl: '', description: '' }]);
    };

    // Xóa một dòng nhập ảnh
    const removeImageInput = (index: number) => {
        setImageInputs(prev => prev.filter((_, i) => i !== index));
    };

    // Cập nhật giá trị của một dòng
    const updateImageInput = (index: number, field: 'questionNumber' | 'imageUrl' | 'description', value: string) => {
        setImageInputs(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    // Lưu ảnh vào câu hỏi
    const saveQuestionImages = async () => {
        if (!createdExam || imageInputs.length === 0) return;

        // Validate inputs
        const validInputs = imageInputs.filter(i => i.questionNumber && i.imageUrl);
        if (validInputs.length === 0) {
            setError('Vui lòng nhập số câu và link ảnh');
            return;
        }

        setSavingImages(true);
        setError('');

        try {
            // Clone questions và cập nhật ảnh
            const updatedQuestions = [...createdExam.questions];

            for (const input of validInputs) {
                const qNum = parseInt(input.questionNumber);
                const questionIndex = updatedQuestions.findIndex(q => q.id === qNum);

                if (questionIndex !== -1) {
                    updatedQuestions[questionIndex] = {
                        ...updatedQuestions[questionIndex],
                        has_image: true,
                        image_url: input.imageUrl,
                        image_description: input.description || ''
                    };
                }
            }

            // Update trong database
            const { error: updateError } = await supabase
                .from('exams')
                .update({ questions: updatedQuestions })
                .eq('id', createdExam.id);

            if (updateError) {
                throw new Error(updateError.message);
            }

            // Cập nhật state local
            setCreatedExam({ ...createdExam, questions: updatedQuestions });
            setImageInputs([]);
            alert(`Đã cập nhật ảnh cho ${validInputs.length} câu hỏi!`);

        } catch (err: any) {
            setError('Lỗi lưu ảnh: ' + err.message);
        } finally {
            setSavingImages(false);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Dashboard Giáo viên</h1>
                    <p>Upload đề thi PDF hoặc Word (.docx) và tạo phòng thi trực tuyến</p>
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
                                        onClick={() => {
                                            setCreatedExam(null);
                                            setImageInputs([]);
                                        }}
                                    >
                                        Tạo đề mới
                                    </button>
                                </div>

                                {/* Form thêm ảnh cho câu hỏi */}
                                <div style={{
                                    marginTop: '2rem',
                                    borderTop: '1px solid var(--border)',
                                    paddingTop: '1.5rem'
                                }}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Image size={18} />
                                            Thêm ảnh cho câu hỏi
                                        </h4>
                                        <button
                                            className="btn btn-sm btn-outline"
                                            onClick={addImageInput}
                                        >
                                            <Plus size={16} />
                                            Thêm
                                        </button>
                                    </div>

                                    <p className="text-sm text-muted mb-3" style={{ lineHeight: '1.5' }}>
                                        💡 <strong>Link ảnh hỗ trợ:</strong> Imgur, ImgBB, Postimages, Google Drive (public),
                                        Supabase Storage, GitHub, hoặc bất kỳ URL ảnh trực tiếp (.jpg, .png, .webp)
                                    </p>

                                    {imageInputs.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {imageInputs.map((input, index) => (
                                                <div key={index} style={{
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    padding: '0.75rem',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-md)'
                                                }}>
                                                    <input
                                                        type="number"
                                                        placeholder="Câu #"
                                                        value={input.questionNumber}
                                                        onChange={(e) => updateImageInput(index, 'questionNumber', e.target.value)}
                                                        style={{
                                                            width: '70px',
                                                            padding: '0.5rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--border)',
                                                            background: 'var(--bg-secondary)'
                                                        }}
                                                        min="1"
                                                        max={createdExam.questions.length}
                                                    />
                                                    <input
                                                        type="url"
                                                        placeholder="Link ảnh (https://...)"
                                                        value={input.imageUrl}
                                                        onChange={(e) => updateImageInput(index, 'imageUrl', e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.5rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--border)',
                                                            background: 'var(--bg-secondary)'
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Mô tả (tùy chọn)"
                                                        value={input.description}
                                                        onChange={(e) => updateImageInput(index, 'description', e.target.value)}
                                                        style={{
                                                            width: '150px',
                                                            padding: '0.5rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            border: '1px solid var(--border)',
                                                            background: 'var(--bg-secondary)'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => removeImageInput(index)}
                                                        style={{
                                                            padding: '0.5rem',
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            border: 'none',
                                                            borderRadius: 'var(--radius-sm)',
                                                            cursor: 'pointer',
                                                            color: 'var(--danger)'
                                                        }}
                                                        title="Xóa"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}

                                            <button
                                                className="btn btn-secondary"
                                                onClick={saveQuestionImages}
                                                disabled={savingImages}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                {savingImages ? (
                                                    <>
                                                        <Loader2 size={16} className="spinner" />
                                                        Đang lưu...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check size={16} />
                                                        Lưu ảnh ({imageInputs.filter(i => i.questionNumber && i.imageUrl).length} câu)
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {imageInputs.length === 0 && (
                                        <p className="text-muted text-center" style={{
                                            padding: '1rem',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            Nhấn "Thêm" để thêm ảnh cho các câu hỏi có hình vẽ
                                        </p>
                                    )}
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
                                        accept=".pdf,.docx,.doc"
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
                                            <p className="font-bold">Kéo thả file PDF hoặc Word vào đây</p>
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
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--danger)', color: 'white' }}
                                                onClick={() => deleteExam(exam.id, exam.title)}
                                                title="Xóa đề thi"
                                            >
                                                <Trash2 size={16} />
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
