import { useEffect, useRef } from 'react';

// Declare MathJax global
declare global {
    interface Window {
        MathJax?: {
            typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
            typeset?: (elements?: HTMLElement[]) => void;
        };
        MathJaxReady?: boolean;
    }
}

interface MathContentProps {
    content: string;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Component để render nội dung có chứa công thức toán học với MathJax
 * Sử dụng: $..$ cho công thức inline, $$..$$ cho công thức block
 */
export function MathContent({ content, className, style }: MathContentProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Chờ MathJax load và render công thức
        const typesetMath = () => {
            if (window.MathJax?.typesetPromise && containerRef.current) {
                window.MathJax.typesetPromise([containerRef.current])
                    .catch((err: any) => console.warn('MathJax typeset error:', err));
            }
        };

        // Nếu MathJax đã ready, typeset ngay
        if (window.MathJaxReady) {
            typesetMath();
        } else {
            // Đợi MathJax load
            const checkInterval = setInterval(() => {
                if (window.MathJaxReady) {
                    clearInterval(checkInterval);
                    typesetMath();
                }
            }, 100);

            return () => clearInterval(checkInterval);
        }
    }, [content]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}

/**
 * Hàm convert các ký hiệu toán học thông thường sang dạng MathJax có thể render
 * Sử dụng khi AI trả về cả LaTeX lẫn Unicode
 */
export function formatMathContent(text: string): string {
    // Nếu đã có $ ký hiệu LaTeX, giữ nguyên
    if (text.includes('$')) {
        return text;
    }

    // Trả về nguyên bản nếu đã có ký hiệu Unicode đẹp
    return text;
}
