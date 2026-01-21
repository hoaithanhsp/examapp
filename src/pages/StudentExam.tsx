import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, AlertTriangle, Clock } from 'lucide-react';
import { updateSubmission } from '../lib/supabase';
import type { Exam, Submission } from '../lib/supabase';
import { MathContent } from '../components/MathContent';


export function StudentExam() {
    const { submissionId } = useParams<{ submissionId: string }>();
    const navigate = useNavigate();

    const [exam, setExam] = useState<Exam | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
    const [timeSpent, setTimeSpent] = useState(0);
    const [exitCount, setExitCount] = useState(0);
    const [showExitWarning, setShowExitWarning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Load exam and submission from localStorage
    useEffect(() => {
        const examData = localStorage.getItem('currentExam');
        const submissionData = localStorage.getItem('currentSubmission');

        if (examData && submissionData) {
            setExam(JSON.parse(examData));
            const sub = JSON.parse(submissionData);
            setSubmission(sub);
            setAnswers(sub.answers || {});
            setTimeSpent(sub.time_spent || 0);
            setExitCount(sub.exit_count || 0);
        } else {
            navigate('/student');
        }
    }, [submissionId, navigate]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeSpent(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Save progress periodically
    useEffect(() => {
        if (!submissionId) return;

        const saveInterval = setInterval(async () => {
            await updateSubmission(submissionId, {
                answers,
                time_spent: timeSpent,
                current_question: currentIndex,
                exit_count: exitCount
            });
        }, 5000);

        return () => clearInterval(saveInterval);
    }, [submissionId, answers, timeSpent, currentIndex, exitCount]);

    // Anti-cheat: Page Visibility API
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden) {
                const newCount = exitCount + 1;
                setExitCount(newCount);
                setShowExitWarning(true);

                // Update immediately
                if (submissionId) {
                    await updateSubmission(submissionId, { exit_count: newCount });
                }
            }
        };

        const handleBlur = async () => {
            const newCount = exitCount + 1;
            setExitCount(newCount);
            setShowExitWarning(true);

            if (submissionId) {
                await updateSubmission(submissionId, { exit_count: newCount });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [exitCount, submissionId]);

    const handleAnswer = useCallback((questionId: number, answer: string | string[]) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateScore = (): number => {
        if (!exam) return 0;

        let correct = 0;
        exam.questions.forEach((q) => {
            const userAnswer = answers[q.id];
            if (userAnswer && q.correct_answer) {
                if (Array.isArray(q.correct_answer)) {
                    if (JSON.stringify(userAnswer) === JSON.stringify(q.correct_answer)) {
                        correct++;
                    }
                } else {
                    if (String(userAnswer).toUpperCase() === String(q.correct_answer).toUpperCase()) {
                        correct++;
                    }
                }
            }
        });
        return correct;
    };

    const handleSubmit = async () => {
        if (!submissionId || !exam) return;

        const confirmed = window.confirm('Bạn có chắc muốn nộp bài? Không thể sửa sau khi nộp.');
        if (!confirmed) return;

        setSubmitting(true);

        const score = calculateScore();

        await updateSubmission(submissionId, {
            answers,
            score,
            total_questions: exam.questions.length,
            time_spent: timeSpent,
            exit_count: exitCount,
            status: 'submitted',
            submitted_at: new Date().toISOString()
        });

        // Save result to localStorage
        localStorage.setItem('examResult', JSON.stringify({
            score,
            total: exam.questions.length,
            timeSpent,
            exitCount,
            answers,
            questions: exam.questions
        }));

        navigate(`/student/result/${submissionId}`);
    };

    if (!exam || !submission) {
        return (
            <div className="page flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    const currentQuestion = exam.questions[currentIndex];
    const progress = ((currentIndex + 1) / exam.questions.length) * 100;
    const answeredCount = Object.keys(answers).length;

    return (
        <div className="page" style={{ paddingBottom: '100px' }}>
            {/* Exit Warning Modal */}
            {showExitWarning && (
                <div className="modal-overlay" onClick={() => setShowExitWarning(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem'
                            }}>
                                <AlertTriangle size={40} style={{ color: 'var(--danger)' }} />
                            </div>
                            <h2 className="mb-2">Cảnh báo!</h2>
                            <p className="text-muted mb-4">
                                Bạn đã rời khỏi màn hình thi.<br />
                                Hành vi này đã được ghi nhận ({exitCount} lần).
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowExitWarning(false)}>
                                Tiếp tục làm bài
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="container" style={{ maxWidth: '800px' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2>{exam.title}</h2>
                        <p className="text-muted text-sm">
                            Câu {currentIndex + 1}/{exam.questions.length} • Đã trả lời: {answeredCount}
                        </p>
                    </div>
                    <div className="flex gap-4 items-center">
                        {exitCount > 0 && (
                            <span className="badge badge-danger">
                                <AlertTriangle size={14} />
                                {exitCount} lần thoát
                            </span>
                        )}
                        <div className="timer">
                            <Clock size={18} />
                            {formatTime(timeSpent)}
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar mb-6">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>

                {/* Question Card */}
                <div className="question-card">
                    <div className="question-card-header">
                        <span className="question-number">Câu hỏi {currentIndex + 1}</span>
                        <span className="badge badge-primary">{currentQuestion.type === 'multiple_choice' ? 'Trắc nghiệm' : currentQuestion.type === 'true_false' ? 'Đúng/Sai' : 'Trả lời ngắn'}</span>
                    </div>

                    <MathContent
                        content={currentQuestion.question}
                        className="question-text"
                    />

                    {/* Hiển thị mô tả hình ảnh nếu có */}
                    {(currentQuestion as any).image_description && (
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            marginBottom: '1rem'
                        }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--primary-light)' }}>
                                📷 Hình ảnh trong câu hỏi:
                            </p>
                            <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                {(currentQuestion as any).image_description}
                            </p>
                        </div>
                    )}

                    {/* Answer Options - Multiple Choice */}
                    {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
                        <div className="options-list">
                            {currentQuestion.options.map((option, idx) => {
                                const letter = option.charAt(0);
                                const isSelected = answers[currentQuestion.id] === letter;
                                return (
                                    <div
                                        key={idx}
                                        className={`option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleAnswer(currentQuestion.id, letter)}
                                    >
                                        <div className="option-radio" />
                                        <MathContent content={option} className="option-text" />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Short Answer */}
                    {currentQuestion.type === 'short_answer' && (
                        <input
                            type="text"
                            className="input input-lg"
                            placeholder="Nhập câu trả lời..."
                            value={(answers[currentQuestion.id] as string) || ''}
                            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                        />
                    )}

                    {currentQuestion.type === 'true_false' && currentQuestion.sub_questions && (
                        <div className="options-list">
                            {currentQuestion.sub_questions.map((sub, idx) => {
                                const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
                                const isTrue = currentAnswers[idx] === 'true';
                                const isFalse = currentAnswers[idx] === 'false';

                                return (
                                    <div key={idx} className="flex gap-4 items-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ flex: 1 }}>{sub.content}</span>
                                        <button
                                            className={`btn btn-sm ${isTrue ? 'btn-secondary' : 'btn-outline'}`}
                                            onClick={() => {
                                                const newAnswers = [...currentAnswers];
                                                newAnswers[idx] = 'true';
                                                handleAnswer(currentQuestion.id, newAnswers);
                                            }}
                                        >
                                            Đúng
                                        </button>
                                        <button
                                            className={`btn btn-sm ${isFalse ? 'btn-danger' : 'btn-outline'}`}
                                            onClick={() => {
                                                const newAnswers = [...currentAnswers];
                                                newAnswers[idx] = 'false';
                                                handleAnswer(currentQuestion.id, newAnswers);
                                            }}
                                        >
                                            Sai
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                    <button
                        className="btn btn-outline"
                        onClick={() => setCurrentIndex(prev => prev - 1)}
                        disabled={currentIndex === 0}
                    >
                        <ChevronLeft size={20} />
                        Câu trước
                    </button>

                    <div className="flex gap-2">
                        {exam.questions.map((_, idx) => (
                            <button
                                key={idx}
                                className="btn btn-sm"
                                style={{
                                    minWidth: '40px',
                                    background: answers[exam.questions[idx].id]
                                        ? 'var(--secondary)'
                                        : idx === currentIndex
                                            ? 'var(--primary)'
                                            : 'var(--bg-tertiary)'
                                }}
                                onClick={() => setCurrentIndex(idx)}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    {currentIndex === exam.questions.length - 1 ? (
                        <button
                            className="btn btn-secondary"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner" style={{ width: '20px', height: '20px' }} />
                                    Đang nộp...
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    Nộp bài
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                        >
                            Câu sau
                            <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
