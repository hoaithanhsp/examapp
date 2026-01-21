import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Question } from './supabase';

// API Key được lưu trong localStorage
const API_KEY_STORAGE = 'gemini_api_key';
const SELECTED_MODEL_STORAGE = 'gemini_selected_model';

export function getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key);
}

export function hasApiKey(): boolean {
    return !!getApiKey();
}

// Danh sách model với fallback - theo thứ tự ưu tiên (CẬP NHẬT 2026)
export const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', isDefault: true },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', isDefault: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', isDefault: false },
];

export function getSelectedModel(): string {
    return localStorage.getItem(SELECTED_MODEL_STORAGE) || AVAILABLE_MODELS[0].id;
}

export function setSelectedModel(modelId: string): void {
    localStorage.setItem(SELECTED_MODEL_STORAGE, modelId);
}

// Lấy danh sách model để thử (bắt đầu từ model được chọn)
function getModelFallbackList(): string[] {
    const selectedModel = getSelectedModel();
    const models = AVAILABLE_MODELS.map(m => m.id);
    const selectedIndex = models.indexOf(selectedModel);

    if (selectedIndex === -1) return models;

    // Bắt đầu từ model được chọn, sau đó thử các model còn lại
    return [...models.slice(selectedIndex), ...models.slice(0, selectedIndex)];
}

// Prompt chuẩn để phân tích đề thi với Gemini Vision
const ANALYSIS_PROMPT = `Bạn là chuyên gia phân tích đề thi Việt Nam. Hãy phân tích đề thi từ hình ảnh này.

QUAN TRỌNG - PHẢI TUÂN THỦ:
1. Trích xuất TẤT CẢ câu hỏi, đáp án một cách CHÍNH XÁC
2. Công thức toán học: Sử dụng LaTeX ĐƯỢC BỌC TRONG $ $
   - Ví dụ: $x^2 + y^2 = z^2$
   - Phân số: $\\frac{a}{b}$
   - Căn: $\\sqrt{2}$, $\\sqrt[3]{8}$
   - Tích phân: $\\int_0^1 f(x)dx$
   - Tổng: $\\sum_{i=1}^{n} i$
   - Giới hạn: $\\lim_{x \\to 0}$
   - Logarit: $\\log_2 x$, $\\ln x$
   - Lượng giác: $\\sin x$, $\\cos x$, $\\tan x$
   - Mũ: $e^x$, $2^n$
   - CHỈ DÙNG $ $ cho công thức inline, KHÔNG dùng $$ $$
3. Nếu câu hỏi có HÌNH VẼ, MÔ TẢ CHI TIẾT hình đó
4. Giữ NGUYÊN số thứ tự câu hỏi

CÁCH PHÂN LOẠI CÂU HỎI:
1. "multiple_choice": Câu trắc nghiệm có 4 đáp án A, B, C, D
2. "true_false": Câu Đúng/Sai có nhiều mệnh đề con (a, b, c, d) - mỗi mệnh đề chọn Đúng hoặc Sai
3. "short_answer": Câu yêu cầu điền số hoặc viết câu trả lời ngắn

Trả về JSON (KHÔNG có markdown block):
{
  "title": "Tên đề thi",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "Câu hỏi với công thức Unicode",
      "options": ["A. Đáp án 1", "B. Đáp án 2", "C. Đáp án 3", "D. Đáp án 4"],
      "correct_answer": "A",
      "has_image": false,
      "image_description": ""
    },
    {
      "id": 2,
      "type": "true_false",
      "question": "Câu hỏi chính của phần Đúng/Sai",
      "sub_questions": [
        {"label": "a", "content": "Mệnh đề a cần đánh giá đúng sai", "correct_answer": "true"},
        {"label": "b", "content": "Mệnh đề b cần đánh giá đúng sai", "correct_answer": "false"},
        {"label": "c", "content": "Mệnh đề c cần đánh giá đúng sai", "correct_answer": "true"},
        {"label": "d", "content": "Mệnh đề d cần đánh giá đúng sai", "correct_answer": "false"}
      ],
      "has_image": false,
      "image_description": ""
    },
    {
      "id": 3,
      "type": "short_answer",
      "question": "Câu hỏi yêu cầu điền đáp án (VD: Tính giá trị biểu thức...)",
      "correct_answer": "42",
      "has_image": true,
      "image_description": "Mô tả chi tiết hình vẽ nếu có: Hình tam giác ABC vuông tại A, AB = 3cm, AC = 4cm..."
    }
  ]
}

LƯU Ý QUAN TRỌNG:
- Câu Đúng/Sai BẮT BUỘC phải có "sub_questions" là mảng các mệnh đề con
- Câu Trả lời ngắn chỉ cần "correct_answer" là giá trị đáp án
- Nếu có hình vẽ, mô tả RÕ RÀNG hình dạng, số đo, các điểm đặc biệt
`;

export interface ParseResult {
    success: boolean;
    title?: string;
    questions?: Question[];
    error?: string;
    usedModel?: string;
}

/**
 * Phân tích đề thi bằng Gemini Vision (gửi ảnh)
 */
export async function analyzeExamWithVision(pageImages: string[]): Promise<ParseResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'Chưa có API Key. Vui lòng nhập API Key trong phần Cài đặt.' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: string = '';


    // Thử từng model cho đến khi thành công
    for (const modelName of getModelFallbackList()) {
        try {
            console.log(`Đang thử model: ${modelName}`);

            const model = genAI.getGenerativeModel({ model: modelName });

            // Chuẩn bị content với ảnh
            const imageParts = pageImages.map((imageBase64) => {
                // Loại bỏ prefix "data:image/jpeg;base64," nếu có
                const base64Data = imageBase64.includes(',')
                    ? imageBase64.split(',')[1]
                    : imageBase64;

                return {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Data
                    }
                };
            });

            // Thêm prompt
            const prompt = pageImages.length > 1
                ? `${ANALYSIS_PROMPT}\n\nĐề thi có ${pageImages.length} trang. Hãy phân tích TẤT CẢ các trang và trích xuất tất cả câu hỏi.`
                : ANALYSIS_PROMPT;

            // Gửi request với ảnh
            const result = await model.generateContent([
                ...imageParts,
                { text: prompt }
            ]);

            const response = await result.response;
            let responseText = response.text();

            console.log('Response từ AI:', responseText.substring(0, 300) + '...');

            // Clean JSON từ response
            responseText = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            // Tìm JSON trong response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                responseText = jsonMatch[0];
            }

            const data = JSON.parse(responseText);

            // Validate structure
            if (!data.questions || !Array.isArray(data.questions)) {
                throw new Error('JSON không có trường questions');
            }

            if (data.questions.length === 0) {
                throw new Error('Không tìm thấy câu hỏi nào trong đề thi');
            }

            // Normalize questions
            const questions: Question[] = data.questions.map((q: any, index: number) => ({
                id: q.id || index + 1,
                type: q.type || 'multiple_choice',
                question: q.question || q.content || '',
                options: q.options || [],
                correct_answer: q.correct_answer || '',
                sub_questions: q.sub_questions || undefined,
                has_image: q.has_image || false,
                image_description: q.image_description || ''
            }));

            console.log(`Thành công với model ${modelName}: ${questions.length} câu hỏi`);

            return {
                success: true,
                title: data.title || 'Đề thi',
                questions,
                usedModel: modelName
            };

        } catch (error: any) {
            console.error(`Model ${modelName} thất bại:`, error);
            lastError = error.message || 'Unknown error';

            // Lỗi 429 - Hết quota
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                return {
                    success: false,
                    error: '🚨 Hết quota API miễn phí! Vui lòng chờ 1 phút hoặc tạo API key mới tại aistudio.google.com/app/apikey'
                };
            }

            // Chỉ dừng ngay với lỗi 401/403 (API key sai thật sự)
            if (error.message?.includes('401') ||
                error.message?.includes('403') ||
                error.message?.includes('API_KEY_INVALID')) {
                return {
                    success: false,
                    error: 'API Key không hợp lệ hoặc chưa được kích hoạt. Vui lòng kiểm tra lại.'
                };
            }

            // Lỗi 400 có thể là model không hỗ trợ, tiếp tục thử model khác
            continue;
        }
    }

    return {
        success: false,
        error: `Không thể phân tích đề thi. Lỗi: ${lastError}`
    };
}

/**
 * Phân tích đề thi từ text (fallback nếu không có ảnh)
 */
export async function analyzeExamText(text: string): Promise<ParseResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'Chưa có API Key. Vui lòng nhập API Key trong phần Cài đặt.' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: string = '';

    const textPrompt = `Bạn là chuyên gia phân tích đề thi. Hãy phân tích đề thi từ văn bản sau:

${text}

QUAN TRỌNG:
1. Trích xuất TẤT CẢ câu hỏi, đáp án
2. Công thức toán học phải viết dạng Unicode đẹp (x², √2, π, ∫, ∑) KHÔNG dùng LaTeX
3. Giữ nguyên số thứ tự câu hỏi

Trả về JSON (KHÔNG có markdown):
{
  "title": "Tên đề thi",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "Câu hỏi",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "A"
    }
  ]
}`;

    for (const modelName of getModelFallbackList()) {
        try {
            console.log(`Đang thử model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(textPrompt);
            const response = await result.response;
            let responseText = response.text();

            // Clean JSON
            responseText = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                responseText = jsonMatch[0];
            }

            const data = JSON.parse(responseText);

            if (!data.questions || data.questions.length === 0) {
                throw new Error('Không tìm thấy câu hỏi');
            }

            const questions: Question[] = data.questions.map((q: any, index: number) => ({
                id: q.id || index + 1,
                type: q.type || 'multiple_choice',
                question: q.question || '',
                options: q.options || [],
                correct_answer: q.correct_answer || '',
                sub_questions: q.sub_questions
            }));

            return {
                success: true,
                title: data.title || 'Đề thi',
                questions,
                usedModel: modelName
            };

        } catch (error: any) {
            console.error(`Model ${modelName} thất bại:`, error);
            lastError = error.message || 'Unknown error';

            // Lỗi 429 - Hết quota
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                return {
                    success: false,
                    error: '🚨 Hết quota API miễn phí! Vui lòng chờ 1 phút hoặc tạo API key mới tại aistudio.google.com/app/apikey'
                };
            }

            // Chỉ dừng ngay với lỗi 401/403 (API key sai thật sự)
            if (error.message?.includes('401') ||
                error.message?.includes('403') ||
                error.message?.includes('API_KEY_INVALID')) {
                return {
                    success: false,
                    error: 'API Key không hợp lệ hoặc chưa được kích hoạt. Vui lòng kiểm tra lại.'
                };
            }

            // Lỗi 400 có thể là model không hỗ trợ, tiếp tục thử model khác
            continue;
        }
    }

    return {
        success: false,
        error: `Không thể phân tích. Lỗi: ${lastError}`
    };
}
