import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, AlertTriangle, Check, X, Home } from 'lucide-react';
import type { Question } from '../lib/supabase';

interface ExamResult {
    score: number;
    total: number;
    timeSpent: number;
    exitCount: number;
    answers: Record<number, string | string[]>;
    questions: Question[];
}

export function StudentResult() {
    const [result, setResult] = useState<ExamResult | null>(null);

    useEffect(() => {
        const resultData = localStorage.getItem('examResult');
        if (resultData) {
            setResult(JSON.parse(resultData));
        }
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins} phút ${secs} giây`;
    };

    const getScoreColor = (score: number, total: number): string => {
        const percent = (score / total) * 100;
        if (percent >= 80) return 'var(--success)';
        if (percent >= 60) return 'var(--warning)';
        return 'var(--danger)';
    };

    const isCorrect = (question: Question, userAnswer: string | string[] | undefined): boolean => {
        if (!userAnswer || !question.correct_answer) return false;

        if (Array.isArray(question.correct_answer)) {
            return JSON.stringify(userAnswer) === JSON.stringify(question.correct_answer);
        }
        return String(userAnswer).toUpperCase() === String(question.correct_answer).toUpperCase();
    };

    if (!result) {
        return (
            <div className="page flex items-center justify-center">
                <div className="text-center">
                    <h2>Không có kết quả</h2>
                    <Link to="/student" className="btn btn-primary mt-4">
                        <Home size={18} />
                        Về trang chủ
                    </Link>
                </div>
            </div>
        );
    }

    const percentage = Math.round((result.score / result.total) * 100);

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: '800px' }}>
                {/* Score Display */}
                <div className="card text-center mb-6">
                    <div style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${getScoreColor(result.score, result.total)}, ${getScoreColor(result.score, result.total)}80)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <Trophy size={50} />
                    </div>

                    <h1 className="mb-2">Hoàn thành!</h1>

                    <div className="score-display">
                        <div className="score-number" style={{ color: getScoreColor(result.score, result.total) }}>
                            {result.score}/{result.total}
                        </div>
                        <div className="score-label">
                            Điểm số: {percentage}%
                        </div>
                    </div>

                    <div className="flex gap-6 justify-center mt-6" style={{ flexWrap: 'wrap' }}>
                        <div className="flex items-center gap-2">
                            <Clock size={20} style={{ color: 'var(--primary)' }} />
                            <span>{formatTime(result.timeSpent)}</span>
                        </div>
                        {result.exitCount > 0 && (
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                                <span>{result.exitCount} lần thoát màn hình</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Answer Review */}
                <div className="card">
                    <h3 className="mb-4">Chi tiết bài làm</h3>

                    <div className="flex flex-col gap-4">
                        {result.questions.map((q, idx) => {
                            const userAnswer = result.answers[q.id];
                            const correct = isCorrect(q, userAnswer);

                            return (
                                <div
                                    key={q.id}
                                    className="p-4"
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: `4px solid ${correct ? 'var(--success)' : 'var(--danger)'}`
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-sm text-muted">Câu {idx + 1}</span>
                                        {correct ? (
                                            <span className="badge badge-success">
                                                <Check size={14} />
                                                Đúng
                                            </span>
                                        ) : (
                                            <span className="badge badge-danger">
                                                <X size={14} />
                                                Sai
                                            </span>
                                        )}
                                    </div>

                                    <p className="font-bold mb-2">{q.question}</p>

                                    <div className="text-sm">
                                        <p>
                                            <span className="text-muted">Đáp án của bạn: </span>
                                            <span style={{ color: correct ? 'var(--success)' : 'var(--danger)' }}>
                                                {Array.isArray(userAnswer) ? userAnswer.join(', ') : (userAnswer || 'Chưa trả lời')}
                                            </span>
                                        </p>
                                        {!correct && q.correct_answer && (
                                            <p>
                                                <span className="text-muted">Đáp án đúng: </span>
                                                <span style={{ color: 'var(--success)' }}>
                                                    {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : q.correct_answer}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center mt-6">
                    <Link to="/student" className="btn btn-primary btn-lg">
                        <Home size={20} />
                        Làm bài thi khác
                    </Link>
                </div>
            </div>
        </div>
    );
}
