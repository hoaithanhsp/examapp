import React, { useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface QuestionImageProps {
    src: string; // Có thể là base64, URL, hoặc Google Drive ID
    alt?: string;
    className?: string;
    maxWidth?: string;
    maxHeight?: string;
}

/**
 * Component hiển thị hình ảnh trong câu hỏi
 * Hỗ trợ base64, URL thông thường, và Google Drive
 */
const QuestionImage: React.FC<QuestionImageProps> = ({
    src,
    alt = 'Hình minh họa',
    className = '',
    maxWidth = '400px',
    maxHeight = '300px'
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [urlIndex, setUrlIndex] = useState(0);

    if (!src || src.trim() === '') {
        return null;
    }

    const cleanSrc = src.trim();

    // Nếu là base64, sử dụng trực tiếp
    if (cleanSrc.startsWith('data:')) {
        return (
            <div className={`question-image-container ${className}`} style={{ margin: '1rem 0', textAlign: 'center' }}>
                {loading && (
                    <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <Loader2 className="spinner" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Đang tải hình ảnh...</span>
                    </div>
                )}
                <img
                    src={cleanSrc}
                    alt={alt}
                    style={{
                        maxWidth,
                        maxHeight,
                        objectFit: 'contain',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        display: loading ? 'none' : 'block',
                        margin: '0 auto'
                    }}
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setError(true);
                    }}
                />
            </div>
        );
    }

    // Nếu là Google Drive ID (không phải URL đầy đủ)
    const isGoogleDriveId = /^[a-zA-Z0-9_-]{25,}$/.test(cleanSrc);

    // Danh sách URL để thử (cho Google Drive)
    const driveUrls = isGoogleDriveId ? [
        `https://drive.usercontent.google.com/download?id=${cleanSrc}&export=view`,
        `https://drive.google.com/thumbnail?id=${cleanSrc}&sz=w1000`,
        `https://lh3.googleusercontent.com/d/${cleanSrc}`,
        `https://drive.google.com/uc?export=view&id=${cleanSrc}`,
    ] : [cleanSrc];

    const currentUrl = driveUrls[urlIndex];

    const handleImageLoad = () => {
        setLoading(false);
        setError(false);
    };

    const handleImageError = () => {
        // Thử URL tiếp theo nếu còn
        if (urlIndex < driveUrls.length - 1) {
            setUrlIndex(prev => prev + 1);
        } else {
            setLoading(false);
            setError(true);
        }
    };

    const handleRetry = () => {
        setUrlIndex(0);
        setLoading(true);
        setError(false);
    };

    return (
        <div className={`question-image-container ${className}`} style={{ margin: '1rem 0', textAlign: 'center' }}>
            {loading && !error && (
                <div style={{
                    padding: '1.5rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px dashed var(--border-color)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Loader2 className="spinner" size={20} />
                    <span style={{ color: 'var(--text-muted)' }}>Đang tải hình ảnh...</span>
                </div>
            )}

            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px dashed rgba(239, 68, 68, 0.3)',
                    display: 'inline-block'
                }}>
                    <AlertCircle size={20} style={{ color: 'var(--danger)', marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.875rem' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Không thể tải ảnh</div>
                        {isGoogleDriveId && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                ID: {cleanSrc.substring(0, 15)}...
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                            <button
                                onClick={handleRetry}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    color: 'var(--danger)'
                                }}
                            >
                                <RefreshCw size={12} />
                                Thử lại
                            </button>
                            {isGoogleDriveId && (
                                <a
                                    href={`https://drive.google.com/file/d/${cleanSrc}/view`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        padding: '0.25rem 0.5rem',
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        color: 'var(--primary)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <ExternalLink size={12} />
                                    Mở Drive
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <img
                src={currentUrl}
                alt={alt}
                style={{
                    maxWidth,
                    maxHeight,
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: loading || error ? 'none' : 'block',
                    margin: '0 auto'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                referrerPolicy="no-referrer"
            />
        </div>
    );
};

export default QuestionImage;
