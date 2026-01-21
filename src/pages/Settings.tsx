import { useState } from 'react';
import { Key, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { getApiKey, setApiKey, hasApiKey } from '../lib/geminiService';

export function Settings() {
    const [apiKey, setApiKeyState] = useState(getApiKey() || '');
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = () => {
        if (!apiKey.trim()) {
            setError('Vui lòng nhập API Key');
            return;
        }

        setApiKey(apiKey.trim());
        setSaved(true);
        setError('');

        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: '600px' }}>
                <div className="page-header">
                    <h1>Cài đặt</h1>
                    <p>Cấu hình API Key để sử dụng tính năng AI</p>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="flex items-center gap-2">
                            <Key size={24} />
                            Gemini API Key
                        </h3>
                    </div>

                    {!hasApiKey() && (
                        <div className="alert alert-warning mb-4">
                            <AlertCircle size={20} />
                            <span>Bạn cần nhập API Key để sử dụng tính năng phân tích PDF</span>
                        </div>
                    )}

                    <div className="input-group">
                        <label>API Key</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="Nhập Gemini API Key..."
                            value={apiKey}
                            onChange={(e) => setApiKeyState(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="alert alert-danger">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {saved && (
                        <div className="alert alert-success">
                            <Check size={20} />
                            <span>Đã lưu API Key thành công!</span>
                        </div>
                    )}

                    <div className="flex gap-4" style={{ marginTop: '1rem' }}>
                        <button onClick={handleSave} className="btn btn-primary">
                            <Check size={18} />
                            Lưu API Key
                        </button>
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                        >
                            <ExternalLink size={18} />
                            Lấy API Key miễn phí
                        </a>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <h4 className="mb-2">Hướng dẫn lấy API Key:</h4>
                        <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.8' }} className="text-muted">
                            <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                            <li>Đăng nhập bằng tài khoản Google</li>
                            <li>Nhấn "Create API Key"</li>
                            <li>Copy key và dán vào ô trên</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
}
