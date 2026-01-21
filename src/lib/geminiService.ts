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

// Danh sách model với fallback - theo thứ tự ưu tiên
export const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview', isDefault: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isDefault: false },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', isDefault: false },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isDefault: false },
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

// Prompt chuẩn để phân tích đề thi
const ANALYSIS_PROMPT = `Bạn là một trợ lý AI chuyên nhập liệu đề thi. Nhiệm vụ của bạn là chuyển đổi văn bản thô từ file PDF thành định dạng JSON chuẩn.

VĂN BẢN ĐẦU VÀO:
{TEXT}

YÊU CẦU OUTPUT (JSON):
{
  "title": "Tên đề thi (nếu tìm thấy)",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "Nội dung câu hỏi",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
      "correct_answer": "A"
    }
  ]
}

QUY TẮC QUAN TRỌNG:
1. Nếu câu hỏi có dạng "A. ... B. ...", hãy gán type="multiple_choice".
2. Nếu câu hỏi yêu cầu điền vào chỗ trống hoặc tính toán, gán type="short_answer".
3. Nếu câu hỏi dạng bảng đúng sai, gán type="true_false" và thêm sub_questions cho từng ý.
4. Bỏ qua các dòng không phải câu hỏi (như số trang, tiêu đề lặp lại).
5. Nếu câu hỏi bị ngắt dòng, hãy nối lại cho liền mạch.
6. TUYỆT ĐỐI chỉ trả về JSON thuần, KHÔNG thêm lời dẫn, KHÔNG có markdown code block.
7. Nếu tìm thấy phần ĐÁP ÁN ở cuối, hãy điền vào correct_answer cho từng câu.`;

export interface ParseResult {
    success: boolean;
    title?: string;
    questions?: Question[];
    error?: string;
}

export async function analyzeExamText(text: string): Promise<ParseResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'Chưa có API Key. Vui lòng nhập API Key trong phần Cài đặt.' };
    }

    // Kiểm tra API key có đúng format không
    if (!apiKey.startsWith('AI') || apiKey.length < 30) {
        return { success: false, error: 'API Key không hợp lệ. Vui lòng kiểm tra lại key trong phần Cài đặt.' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: string = '';

    // Thử từng model cho đến khi thành công
    for (const modelName of getModelFallbackList()) {
        try {
            console.log(`Đang thử model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = ANALYSIS_PROMPT.replace('{TEXT}', text);

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let responseText = response.text();

            console.log('Response từ AI:', responseText.substring(0, 200) + '...');

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
                sub_questions: q.sub_questions || undefined
            }));

            console.log(`Thành công với model ${modelName}: ${questions.length} câu hỏi`);

            return {
                success: true,
                title: data.title || data.exam_title || 'Đề thi',
                questions
            };

        } catch (error: any) {
            console.error(`Model ${modelName} thất bại:`, error);
            lastError = error.message || 'Unknown error';

            // Nếu lỗi 400/401/403 (API key sai), dừng ngay
            if (error.message?.includes('400') ||
                error.message?.includes('401') ||
                error.message?.includes('403') ||
                error.message?.includes('API_KEY_INVALID')) {
                return {
                    success: false,
                    error: 'API Key không hợp lệ hoặc chưa được kích hoạt. Vui lòng kiểm tra lại.'
                };
            }

            // Nếu là lỗi quota hoặc rate limit, thử model tiếp theo
            if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                console.log('Rate limit, thử model tiếp theo...');
                continue;
            }

            // Nếu là lỗi model không tồn tại, thử model tiếp theo
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                console.log('Model không tồn tại, thử model tiếp theo...');
                continue;
            }

            // Các lỗi khác, thử model tiếp theo
            continue;
        }
    }

    return {
        success: false,
        error: `Không thể phân tích đề thi. Lỗi: ${lastError}. Vui lòng kiểm tra API Key hoặc thử lại sau.`
    };
}

