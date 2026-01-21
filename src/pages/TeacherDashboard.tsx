import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Upload, FileText, Check, AlertCircle, Eye, Loader2, Trash2, Image, Plus, X, Edit, Users } from 'lucide-react';
import { extractTextFromPDF, isPDFFile } from '../lib/pdfParser';
import { extractFromWord, isWordFile } from '../lib/wordParser';
import { analyzeExamWithVision, analyzeExamText, hasApiKey } from '../lib/geminiService';
import { createExam, generateRoomCode, supabase, uploadQuestionImage, saveClassStudents, getClassStudents } from '../lib/supabase';
import type { Exam, ClassStudent } from '../lib/supabase';
import * as XLSX from 'xlsx';

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
    const [editingExam, setEditingExam] = useState<Exam | null>(null);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

    // State cho quản lý danh sách lớp từ Excel
    const [showClassModal, setShowClassModal] = useState(false);
    const [classStudents, setClassStudents] = useState<Omit<ClassStudent, 'id' | 'exam_id' | 'created_at'>[]>([]);
    const [savingClass, setSavingClass] = useState(false);
    const [classExamId, setClassExamId] = useState<string>('');
    const [existingClassCount, setExistingClassCount] = useState<number>(0);

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

    // Upload file ảnh lên Supabase Storage
    const handleFileUpload = async (index: number, file: File) => {
        const input = imageInputs[index];
        if (!input.questionNumber) {
            setError('Vui lòng nhập số câu trước khi upload ảnh');
            return;
        }

        const examId = editingExam?.id || createdExam?.id;
        if (!examId) {
            setError('Không tìm thấy đề thi');
            return;
        }

        setUploadingIndex(index);
        setError('');

        try {
            const result = await uploadQuestionImage(file, examId, parseInt(input.questionNumber));

            if (result.success && result.url) {
                // Tự động điền URL vào input
                updateImageInput(index, 'imageUrl', result.url);
            } else {
                setError('Upload thất bại: ' + (result.error || 'Lỗi không xác định. Hãy kiểm tra bucket "question-images" đã được tạo trên Supabase chưa.'));
            }
        } catch (err: any) {
            setError('Upload thất bại: ' + err.message);
        } finally {
            setUploadingIndex(null);
        }
    };

    // Chuyển đổi link ảnh sang dạng có thể embed
    const convertToDirectImageUrl = (url: string): string => {
        // Google Drive: https://drive.google.com/file/d/FILE_ID/view... → https://drive.google.com/uc?export=view&id=FILE_ID
        const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (gdriveMatch) {
            return `https://drive.google.com/uc?export=view&id=${gdriveMatch[1]}`;
        }

        // Google Drive dạng open: https://drive.google.com/open?id=FILE_ID
        const gdriveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (gdriveOpenMatch) {
            return `https://drive.google.com/uc?export=view&id=${gdriveOpenMatch[1]}`;
        }

        // Dropbox: ?dl=0 → ?raw=1
        if (url.includes('dropbox.com') && url.includes('?dl=0')) {
            return url.replace('?dl=0', '?raw=1');
        }

        // Trả về URL gốc nếu không cần chuyển đổi
        return url;
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
                        image_url: convertToDirectImageUrl(input.imageUrl),
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

    // Lưu ảnh cho exam đang được edit
    const saveEditingExamImages = async () => {
        if (!editingExam || imageInputs.length === 0) return;

        const validInputs = imageInputs.filter(i => i.questionNumber && i.imageUrl);
        if (validInputs.length === 0) {
            setError('Vui lòng nhập số câu và link ảnh');
            return;
        }

        setSavingImages(true);
        setError('');

        try {
            const updatedQuestions = [...editingExam.questions];

            for (const input of validInputs) {
                const qNum = parseInt(input.questionNumber);
                const questionIndex = updatedQuestions.findIndex(q => q.id === qNum);

                if (questionIndex !== -1) {
                    updatedQuestions[questionIndex] = {
                        ...updatedQuestions[questionIndex],
                        has_image: true,
                        image_url: convertToDirectImageUrl(input.imageUrl),
                        image_description: input.description || ''
                    };
                }
            }

            const { error: updateError } = await supabase
                .from('exams')
                .update({ questions: updatedQuestions })
                .eq('id', editingExam.id);

            if (updateError) {
                throw new Error(updateError.message);
            }

            // Cập nhật state local
            setExams(prev => prev.map(e =>
                e.id === editingExam.id ? { ...e, questions: updatedQuestions } : e
            ));
            setEditingExam(null);
            setImageInputs([]);
            alert(`Đã cập nhật ảnh cho ${validInputs.length} câu hỏi!`);

        } catch (err: any) {
            setError('Lỗi lưu ảnh: ' + err.message);
        } finally {
            setSavingImages(false);
        }
    };

    // ============ XỬ LÝ DANH SÁCH LỚP TỪ EXCEL ============

    // Parse file Excel để lấy danh sách học sinh
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target?.result, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                // Bỏ dòng header đầu tiên
                const rows = data.slice(1).filter(row => row.length >= 2);

                // Parse dữ liệu - hỗ trợ các tên cột khác nhau
                const students = rows.map(row => ({
                    full_name: String(row[0] || '').trim(),
                    student_code: String(row[1] || '').trim().toUpperCase(),
                    password: String(row[2] || '').trim(),
                    birth_date: String(row[3] || '').trim(),
                    class_name: String(row[4] || '').trim()
                })).filter(s => s.full_name && s.student_code && s.password);

                setClassStudents(students);
                setError('');
            } catch (err: any) {
                setError('Lỗi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Mở modal upload danh sách lớp cho một đề thi
    const openClassModal = async (examId: string) => {
        setClassExamId(examId);
        setClassStudents([]);
        setShowClassModal(true);

        // Kiểm tra xem đã có danh sách chưa
        const existing = await getClassStudents(examId);
        setExistingClassCount(existing.length);
        if (existing.length > 0) {
            // Hiển thị danh sách hiện có
            setClassStudents(existing.map(s => ({
                full_name: s.full_name,
                student_code: s.student_code,
                password: s.password,
                birth_date: s.birth_date,
                class_name: s.class_name
            })));
        }
    };

    // Lưu danh sách lớp vào database
    const saveClassList = async () => {
        if (!classExamId || classStudents.length === 0) return;

        setSavingClass(true);
        setError('');

        try {
            const result = await saveClassStudents(classExamId, classStudents);
            if (result.success) {
                alert(`Đã lưu danh sách ${classStudents.length} học sinh!`);
                setShowClassModal(false);
                setClassStudents([]);
            } else {
                setError('Lỗi lưu danh sách: ' + (result.error || 'Không xác định'));
            }
        } catch (err: any) {
            setError('Lỗi: ' + err.message);
        } finally {
            setSavingClass(false);
        }
    };


    return (
        <>
            {/* Modal chỉnh sửa đề thi - Thêm ảnh */}
            {editingExam && (
                <div className="modal-overlay" onClick={() => setEditingExam(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 style={{ margin: 0 }}>
                                <Image size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                Thêm ảnh - {editingExam.title}
                            </h3>
                            <button
                                onClick={() => setEditingExam(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-muted mb-3">
                            Đề có {editingExam.questions.length} câu hỏi. Nhập số câu và link ảnh hoặc upload file bên dưới.
                        </p>

                        <p className="text-sm text-muted mb-3" style={{ lineHeight: '1.5' }}>
                            💡 <strong>Hỗ trợ:</strong> Nhập link (Imgur, Google Drive) hoặc upload file (.jpg, .png, .gif, .webp)
                        </p>

                        {/* Nút thêm dòng */}
                        <button className="btn btn-outline btn-sm mb-3" onClick={addImageInput}>
                            <Plus size={16} /> Thêm ảnh
                        </button>

                        {/* Danh sách input */}
                        {imageInputs.map((input, index) => (
                            <div key={index} style={{
                                display: 'flex', gap: '0.5rem', marginBottom: '0.5rem',
                                padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                            }}>
                                <input
                                    type="number"
                                    placeholder="Câu #"
                                    value={input.questionNumber}
                                    onChange={(e) => updateImageInput(index, 'questionNumber', e.target.value)}
                                    style={{ width: '60px', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                                    min="1" max={editingExam.questions.length}
                                />
                                <input
                                    type="url"
                                    placeholder="Link ảnh hoặc upload →"
                                    value={input.imageUrl}
                                    onChange={(e) => updateImageInput(index, 'imageUrl', e.target.value)}
                                    style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                                />
                                {/* Nút upload file */}
                                <label style={{
                                    padding: '0.5rem',
                                    background: uploadingIndex === index ? 'var(--bg-tertiary)' : 'var(--primary)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: uploadingIndex === index ? 'wait' : 'pointer',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center'
                                }} title="Upload ảnh từ máy">
                                    {uploadingIndex === index ? (
                                        <Loader2 size={16} className="spinner" />
                                    ) : (
                                        <Upload size={16} />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(index, file);
                                        }}
                                        disabled={uploadingIndex !== null}
                                    />
                                </label>
                                <input
                                    type="text"
                                    placeholder="Mô tả"
                                    value={input.description}
                                    onChange={(e) => updateImageInput(index, 'description', e.target.value)}
                                    style={{ width: '80px', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
                                />
                                <button onClick={() => removeImageInput(index)} style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--danger)' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        ))}

                        {imageInputs.length === 0 && (
                            <p className="text-muted text-center" style={{ padding: '2rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                Nhấn "Thêm ảnh" để bắt đầu
                            </p>
                        )}

                        {/* Nút lưu */}
                        {imageInputs.length > 0 && (
                            <button
                                className="btn btn-secondary mt-4"
                                onClick={saveEditingExamImages}
                                disabled={savingImages}
                                style={{ width: '100%' }}
                            >
                                {savingImages ? (
                                    <><Loader2 size={16} className="spinner" /> Đang lưu...</>
                                ) : (
                                    <><Check size={16} /> Lưu ảnh ({imageInputs.filter(i => i.questionNumber && i.imageUrl).length} câu)</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Upload Danh sách lớp từ Excel */}
            {showClassModal && (
                <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '85vh', overflow: 'auto' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 style={{ margin: 0 }}>
                                <Users size={20} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                Upload Danh sách lớp
                            </h3>
                            <button
                                onClick={() => setShowClassModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {existingClassCount > 0 && (
                            <div className="alert alert-success mb-3">
                                <Check size={16} />
                                <span>Đề thi này đã có {existingClassCount} học sinh trong danh sách</span>
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                            <p className="text-sm mb-2"><strong>📋 Mẫu file Excel (theo thứ tự cột):</strong></p>
                            <p className="text-sm text-muted" style={{ lineHeight: '1.6' }}>
                                | Họ và tên | Mã số học sinh | Mật khẩu | Ngày sinh | Lớp |<br />
                                | Lưu Đức Bảo An | HS01 | 123 | 20/03/2010 | 10A |
                            </p>
                        </div>

                        {/* Input file */}
                        <div className="mb-4">
                            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                                <Upload size={16} />
                                Chọn file Excel (.xlsx)
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleExcelUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {/* Preview danh sách */}
                        {classStudents.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <p className="text-sm mb-2"><strong>👥 Danh sách học sinh ({classStudents.length} em):</strong></p>
                                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Họ và tên</th>
                                                <th>Mã số</th>
                                                <th>Mật khẩu</th>
                                                <th>Ngày sinh</th>
                                                <th>Lớp</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {classStudents.map((s, idx) => (
                                                <tr key={idx}>
                                                    <td>{idx + 1}</td>
                                                    <td>{s.full_name}</td>
                                                    <td><strong>{s.student_code}</strong></td>
                                                    <td>{s.password}</td>
                                                    <td>{s.birth_date}</td>
                                                    <td>{s.class_name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {classStudents.length === 0 && (
                            <p className="text-muted text-center" style={{ padding: '2rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                Chọn file Excel để xem preview danh sách
                            </p>
                        )}

                        {/* Nút lưu */}
                        {classStudents.length > 0 && (
                            <button
                                className="btn btn-secondary mt-4"
                                onClick={saveClassList}
                                disabled={savingClass}
                                style={{ width: '100%' }}
                            >
                                {savingClass ? (
                                    <><Loader2 size={16} className="spinner" /> Đang lưu...</>
                                ) : (
                                    <><Check size={16} /> Lưu danh sách ({classStudents.length} học sinh)</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

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
                                                    style={{ background: 'var(--secondary)', color: 'white' }}
                                                    onClick={() => openClassModal(exam.id)}
                                                    title="Upload danh sách lớp"
                                                >
                                                    <Users size={16} />
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ background: 'var(--warning)', color: 'white' }}
                                                    onClick={() => {
                                                        setEditingExam(exam);
                                                        setImageInputs([]);
                                                    }}
                                                    title="Sửa / Thêm ảnh"
                                                >
                                                    <Edit size={16} />
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
        </>
    );
}
