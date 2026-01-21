import { useState, useEffect } from 'react';
import { Key, ExternalLink, Check, AlertCircle, Cpu, Zap } from 'lucide-react';
import {
    getApiKey,
    setApiKey,
    hasApiKey,
    AVAILABLE_MODELS,
    getSelectedModel,
    setSelectedModel
} from '../lib/geminiService';

export function Settings() {
    const [apiKey, setApiKeyState] = useState(getApiKey() || '');
    const [selectedModel, setSelectedModelState] = useState(getSelectedModel());
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setSelectedModelState(getSelectedModel());
    }, []);

    const handleSaveKey = () => {
        if (!apiKey.trim()) {
            setError('Vui lòng nhập API Key');
            return;
        }

        if (!apiKey.startsWith('AI') || apiKey.length < 30) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AI" và dài ít nhất 30 ký tự');
            return;
        }

        setApiKey(apiKey.trim());
        setSaved(true);
        setError('');

        setTimeout(() => setSaved(false), 3000);
    };

    const handleSelectModel = (modelId: string) => {
        setSelectedModel(modelId);
        setSelectedModelState(modelId);
    };

    return (
        <div className="page">
            <div className="container" style={{ maxWidth: '700px' }}>
                <div className="page-header">
                    <h1>Cài đặt</h1>
                    <p>Cấu hình API Key và Model AI</p>
                </div>

                {/* API Key Section */}
                <div className="card mb-6">
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
                            placeholder="Nhập Gemini API Key (bắt đầu bằng AIza...)"
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

                    <div className="flex gap-4" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
                        <button onClick={handleSaveKey} className="btn btn-primary">
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

                    {/* Hướng dẫn chi tiết */}
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <h4 className="mb-2 flex items-center gap-2">
                            <Zap size={18} style={{ color: 'var(--warning)' }} />
                            Hướng dẫn lấy API Key
                        </h4>
                        <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.8' }} className="text-muted">
                            <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                            <li>Đăng nhập bằng tài khoản Google</li>
                            <li>Nhấn "Create API Key" → Chọn project hoặc tạo mới</li>
                            <li>Copy key (bắt đầu bằng <code>AIza...</code>) và dán vào ô trên</li>
                        </ol>
                        <p className="text-sm mt-4">
                            📹 <a
                                href="https://drive.google.com/drive/folders/1G6eiVeeeEvsYgNk2Om7FEybWf30EP1HN?usp=drive_link"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--primary-light)', fontWeight: 'bold' }}
                            >
                                Xem video hướng dẫn chi tiết tại đây
                            </a>
                        </p>
                    </div>
                </div>

                {/* Model Selection Section */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="flex items-center gap-2">
                            <Cpu size={24} />
                            Chọn Model AI
                        </h3>
                    </div>

                    <p className="text-muted mb-4">
                        Chọn model mặc định. Nếu model gặp lỗi hoặc quá tải, hệ thống sẽ tự động chuyển sang model tiếp theo.
                    </p>

                    <div className="grid" style={{ gap: '0.75rem' }}>
                        {AVAILABLE_MODELS.map((model) => (
                            <div
                                key={model.id}
                                onClick={() => handleSelectModel(model.id)}
                                className="flex items-center justify-between p-4"
                                style={{
                                    background: selectedModel === model.id ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-tertiary)',
                                    border: `2px solid ${selectedModel === model.id ? 'var(--primary)' : 'transparent'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div>
                                    <p className="font-bold">{model.name}</p>
                                    <p className="text-sm text-muted">{model.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {model.isDefault && (
                                        <span className="badge badge-primary">Mặc định</span>
                                    )}
                                    {selectedModel === model.id && (
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'var(--primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Check size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="alert alert-success mt-4" style={{ background: 'rgba(37, 99, 235, 0.1)', borderColor: 'var(--primary)' }}>
                        <Zap size={20} style={{ color: 'var(--primary)' }} />
                        <span style={{ color: 'var(--text-primary)' }}>
                            <strong>Cơ chế Fallback:</strong> Nếu model đang chọn gặp lỗi (quota, rate limit...),
                            hệ thống sẽ tự động thử các model khác theo thứ tự từ trên xuống.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
