import * as pdfjsLib from 'pdfjs-dist';

// Cấu hình worker cho PDF.js - sử dụng legacy build để tránh vấn đề worker
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PDFParseResult {
    success: boolean;
    text?: string;
    pageCount?: number;
    error?: string;
}

/**
 * Đọc nội dung text từ file PDF
 */
export async function extractTextFromPDF(file: File): Promise<PDFParseResult> {
    try {
        // Đọc file thành ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageCount = pdf.numPages;

        let fullText = '';

        // Đọc từng trang
        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Ghép các items thành text
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += pageText + '\n\n';
        }

        // Clean up text
        fullText = cleanText(fullText);

        if (!fullText.trim()) {
            return {
                success: false,
                error: 'File PDF này có thể là dạng ảnh scan. Vui lòng dùng công cụ OCR để chuyển sang văn bản trước.'
            };
        }

        return {
            success: true,
            text: fullText,
            pageCount
        };

    } catch (error: any) {
        console.error('Error parsing PDF:', error);

        if (error.message?.includes('password')) {
            return {
                success: false,
                error: 'File PDF bị đặt mật khẩu. Vui lòng mở khóa trước khi upload.'
            };
        }

        return {
            success: false,
            error: `Không thể đọc file PDF: ${error.message}`
        };
    }
}

/**
 * Làm sạch text đã trích xuất
 */
function cleanText(text: string): string {
    return text
        // Xóa nhiều khoảng trắng liên tiếp
        .replace(/\s+/g, ' ')
        // Xóa các dòng chỉ có số (thường là số trang)
        .replace(/^\s*\d+\s*$/gm, '')
        // Xóa các header/footer phổ biến
        .replace(/Trang \d+ \/ \d+/gi, '')
        .replace(/Page \d+ of \d+/gi, '')
        // Chuẩn hóa xuống dòng
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Kiểm tra file có phải PDF không
 */
export function isPDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
