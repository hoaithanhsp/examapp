import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, User, Lock, Shield } from 'lucide-react';
import { verifyTeacherLogin, saveTeacherSession } from '../data/accountvip';

export function TeacherLogin() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username.trim()) {
            setError('Vui lòng nhập tài khoản');
            return;
        }

        if (!password.trim()) {
            setError('Vui lòng nhập mật khẩu');
            return;
        }

        setLoading(true);
        setError('');

        // Giả lập delay để tạo cảm giác đang xử lý
        await new Promise(resolve => setTimeout(resolve, 500));

        const account = verifyTeacherLogin(username.trim(), password);

        if (account) {
            saveTeacherSession(account);
            navigate('/teacher');
        } else {
            setError('Tài khoản hoặc mật khẩu không đúng');
        }

        setLoading(false);
    };

    return (
        <div className="page flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
                <div className="text-center mb-6">
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <Shield size={40} />
                    </div>
                    <h2>Đăng Nhập Giáo Viên</h2>
                    <p className="text-muted">Nhập tài khoản VIP để truy cập</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label className="flex items-center gap-2">
                            <User size={16} />
                            Tài khoản
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Nhập tài khoản..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
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
                            autoComplete="current-password"
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
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner" style={{ width: '20px', height: '20px' }} />
                                Đang đăng nhập...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Đăng Nhập
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <p className="text-sm text-muted">
                        Liên hệ quản trị viên để được cấp tài khoản VIP
                    </p>
                </div>
            </div>
        </div>
    );
}
