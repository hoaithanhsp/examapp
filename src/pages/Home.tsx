import { Link } from 'react-router-dom';
import { BookOpen, Users, Shield, Zap } from 'lucide-react';

export function Home() {
    return (
        <div className="page">
            <div className="container">
                {/* Hero Section */}
                <section className="text-center mb-6" style={{ paddingTop: '3rem' }}>
                    <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        Ứng Dụng
                        <span style={{
                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginLeft: '0.5rem'
                        }}>
                            Thi Trực Tuyến
                        </span>
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem' }}>
                        Upload PDF đề thi, AI tự động tạo câu hỏi tương tác.
                        Theo dõi realtime, chống gian lận, chấm điểm tự động.
                    </p>

                    <div className="flex gap-4 justify-center" style={{ flexWrap: 'wrap' }}>
                        <Link to="/teacher" className="btn btn-primary btn-lg">
                            <BookOpen size={24} />
                            Giáo viên
                        </Link>
                        <Link to="/student" className="btn btn-secondary btn-lg">
                            <Users size={24} />
                            Học sinh
                        </Link>
                    </div>
                </section>

                {/* Features */}
                <section className="grid grid-2" style={{ marginTop: '4rem' }}>
                    <div className="card">
                        <div className="flex items-center gap-4 mb-4">
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: 'var(--radius-lg)',
                                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap size={24} />
                            </div>
                            <h3>AI Phân Tích Đề Thi</h3>
                        </div>
                        <p className="text-muted">
                            Upload PDF, AI tự động nhận diện câu hỏi trắc nghiệm, đúng/sai,
                            trả lời ngắn và tạo đề thi tương tác.
                        </p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-4 mb-4">
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: 'var(--radius-lg)',
                                background: 'linear-gradient(135deg, var(--secondary), var(--secondary-dark))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Users size={24} />
                            </div>
                            <h3>Theo Dõi Realtime</h3>
                        </div>
                        <p className="text-muted">
                            Xem học sinh làm bài trực tiếp. Biết ai đang làm câu nào,
                            thời gian còn lại, và phát hiện hành vi gian lận.
                        </p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-4 mb-4">
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: 'var(--radius-lg)',
                                background: 'linear-gradient(135deg, var(--warning), #d97706)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Shield size={24} />
                            </div>
                            <h3>Chống Gian Lận</h3>
                        </div>
                        <p className="text-muted">
                            Theo dõi khi học sinh chuyển tab hoặc rời màn hình.
                            Ghi nhận và cảnh báo ngay lập tức.
                        </p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-4 mb-4">
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: 'var(--radius-lg)',
                                background: 'linear-gradient(135deg, var(--success), #16a34a)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <BookOpen size={24} />
                            </div>
                            <h3>Chấm Điểm Tự Động</h3>
                        </div>
                        <p className="text-muted">
                            Điểm số được tính ngay khi học sinh nộp bài.
                            Xuất báo cáo Excel dễ dàng.
                        </p>
                    </div>
                </section>

                {/* Quick Start */}
                <section className="card" style={{ marginTop: '3rem', textAlign: 'center' }}>
                    <h3 className="mb-4">Bắt đầu nhanh</h3>
                    <div className="flex gap-6 justify-center" style={{ flexWrap: 'wrap' }}>
                        <div>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.5rem',
                                fontWeight: 'bold'
                            }}>1</div>
                            <p className="text-sm text-muted">Upload PDF đề thi</p>
                        </div>
                        <div>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.5rem',
                                fontWeight: 'bold'
                            }}>2</div>
                            <p className="text-sm text-muted">Nhận mã phòng thi</p>
                        </div>
                        <div>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.5rem',
                                fontWeight: 'bold'
                            }}>3</div>
                            <p className="text-sm text-muted">Học sinh vào thi</p>
                        </div>
                        <div>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'var(--secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 0.5rem',
                                fontWeight: 'bold'
                            }}>4</div>
                            <p className="text-sm text-muted">Xem kết quả realtime</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
