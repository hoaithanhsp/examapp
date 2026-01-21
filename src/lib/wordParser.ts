/**
 * Word Parser - Đọc và trích xuất nội dung từ file Word (.docx)
 * Hỗ trợ văn bản, hình ảnh, và công thức LaTeX
 */
import mammoth from 'mammoth';

export interface WordParseResult {
    success: boolean;
    html?: string;
    text?: string;
    images?: WordImage[];
    error?: string;
}

export interface WordImage {
    contentType: string;
    base64: string;
    altText?: string;
}

/**
 * Đọc file Word và trích xuất nội dung + hình ảnh
 */
export async function extractFromWord(file: File): Promise<WordParseResult> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const images: WordImage[] = [];

        // Cấu hình mammoth để trích xuất hình ảnh
        const options = {
            convertImage: mammoth.images.imgElement(async (image: any) => {
                const imageBuffer = await image.read('base64');
                const contentType = image.contentType || 'image/png';

                // Lưu ảnh vào mảng
                const imageIndex = images.length;
                images.push({
                    contentType,
                    base64: imageBuffer,
                    altText: `Hình ${imageIndex + 1}`
                });

                // Trả về data URL để embed vào HTML
                return {
                    src: `data:${contentType};base64,${imageBuffer}`
                };
            })
        };

        // Convert Word sang HTML
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        const html = result.value;

        // Cũng lấy text thuần
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        const text = textResult.value;

        if (!text.trim() && !html.trim()) {
            return {
                success: false,
                error: 'File Word trống hoặc không thể đọc nội dung'
            };
        }

        // Log warnings nếu có
        if (result.messages.length > 0) {
            console.warn('Word parsing warnings:', result.messages);
        }

        return {
            success: true,
            html,
            text,
            images
        };

    } catch (error: any) {
        console.error('Error parsing Word:', error);
        return {
            success: false,
            error: `Không thể đọc file Word: ${error.message}`
        };
    }
}

/**
 * Kiểm tra file có phải Word không
 */
export function isWordFile(file: File): boolean {
    const wordTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ];
    return wordTypes.includes(file.type) ||
        file.name.toLowerCase().endsWith('.docx') ||
        file.name.toLowerCase().endsWith('.doc');
}

/**
 * Xử lý HTML từ Word để chuẩn hóa cho việc phân tích
 */
export function preprocessWordHtml(html: string): string {
    let processed = html;

    // Xóa các style inline không cần thiết
    processed = processed.replace(/style="[^"]*"/gi, '');

    // Chuẩn hóa các tag
    processed = processed.replace(/<strong>/gi, '<b>');
    processed = processed.replace(/<\/strong>/gi, '</b>');
    processed = processed.replace(/<em>/gi, '<i>');
    processed = processed.replace(/<\/em>/gi, '</i>');

    // Xóa các tag rỗng
    processed = processed.replace(/<p>\s*<\/p>/gi, '');
    processed = processed.replace(/<span>\s*<\/span>/gi, '');

    return processed.trim();
}
