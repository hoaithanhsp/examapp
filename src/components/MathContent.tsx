import { useEffect, useRef, memo } from 'react';

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
    block?: boolean; // true = block display, false = inline
}

/**
 * Component để render nội dung có chứa công thức toán học với MathJax
 * Sử dụng: $..$ cho công thức inline, $$..$$ cho công thức block
 * 
 * Tham khảo từ: help/MathText.tsx
 */
export const MathContent = memo(function MathContent({
    content,
    className = '',
    style,
    block = false
}: MathContentProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const renderMath = async () => {
            if (window.MathJax && containerRef.current) {
                // Xử lý nội dung: Nếu không phải mode block, chuyển $$ thành $ để ép hiển thị inline
                let processedContent = content;
                if (!block) {
                    // Thay thế $$...$$ thành $...$ để ép inline
                    processedContent = content.replace(/\$\$/g, '$');
                }

                // Gán nội dung
                containerRef.current.innerHTML = processedContent;

                try {
                    // Xóa attribute cũ để MathJax render lại
                    containerRef.current.removeAttribute('data-mathjax-type');

                    // Yêu cầu MathJax render
                    if (window.MathJax.typesetPromise) {
                        await window.MathJax.typesetPromise([containerRef.current]);
                    }
                } catch (err) {
                    console.warn('MathJax error:', err);
                }
            } else if (containerRef.current) {
                // Fallback nếu MathJax chưa load
                containerRef.current.innerHTML = content;
            }
        };

        // Nếu MathJax đã ready, typeset ngay
        if (window.MathJaxReady) {
            renderMath();
        } else {
            // Đợi MathJax load
            const checkInterval = setInterval(() => {
                if (window.MathJaxReady) {
                    clearInterval(checkInterval);
                    renderMath();
                }
            }, 100);

            // Cleanup sau 5 giây nếu MathJax không load
            const timeout = setTimeout(() => {
                clearInterval(checkInterval);
                if (containerRef.current) {
                    containerRef.current.innerHTML = content;
                }
            }, 5000);

            return () => {
                clearInterval(checkInterval);
                clearTimeout(timeout);
            };
        }
    }, [content, block]);

    const Component = block ? 'div' : 'span';

    return (
        <Component
            ref={containerRef as any}
            className={`${className} ${!block ? 'inline-math-wrapper' : ''}`}
            style={{
                display: block ? 'block' : 'inline',
                ...style
            }}
        />
    );
});

/**
 * Hàm format nội dung để MathJax render đúng
 */
export function formatMathContent(text: string): string {
    // Nếu đã có $ ký hiệu LaTeX, giữ nguyên
    if (text.includes('$')) {
        return text;
    }

    // Trả về nguyên bản
    return text;
}

export default MathContent;
