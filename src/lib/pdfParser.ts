import * as pdfjsLib from 'pdfjs-dist';

// Cấu hình worker cho PDF.js
// @ts-ignore
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface PDFParseResult {
    success: boolean;
    text?: string;
    pageCount?: number;
    pageImages?: string[]; // Base64 images của từng trang
    error?: string;
}

/**
 * Render một trang PDF thành ảnh base64
 */
async function renderPageToImage(page: any, scale: number = 2): Promise<string> {
    const viewport = page.getViewport({ scale });

    // Tạo canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page vào canvas
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Convert canvas thành base64 (JPEG để giảm dung lượng)
    return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Đọc nội dung từ file PDF - trích xuất cả text và ảnh
 */
export async function extractTextFromPDF(file: File): Promise<PDFParseResult> {
    try {
        // Đọc file thành ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageCount = pdf.numPages;

        let fullText = '';
        const pageImages: string[] = [];

        // Đọc từng trang
        for (let i = 1; i <= pageCount; i++) {
            const page = await pdf.getPage(i);

            // Trích xuất text
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += pageText + '\n\n';

            // Render trang thành ảnh cho Gemini Vision
            try {
                const imageBase64 = await renderPageToImage(page);
                pageImages.push(imageBase64);
            } catch (renderError) {
                console.warn(`Không thể render trang ${i}:`, renderError);
            }
        }

        // Clean up text
        fullText = cleanText(fullText);

        return {
            success: true,
            text: fullText,
            pageCount,
            pageImages
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
