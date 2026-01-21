import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Question } from './supabase';

// API Key được lưu trong localStorage
const API_KEY_STORAGE = 'gemini_api_key';

export function getApiKey(): string | null {
    return localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key);
}

export function hasApiKey(): boolean {
    return !!getApiKey();
}

// Danh sách model fallback
const MODELS = [
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

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
      "type": "multiple_choice", // hoặc "true_false" hoặc "short_answer"
      "question": "Nội dung câu hỏi",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"], // nếu có
      "correct_answer": "A" // nếu tìm thấy đáp án
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

    const genAI = new GoogleGenerativeAI(apiKey);

    // Thử từng model cho đến khi thành công
    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const prompt = ANALYSIS_PROMPT.replace('{TEXT}', text);

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let responseText = response.text();

            // Clean JSON từ response
            responseText = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const data = JSON.parse(responseText);

            // Validate structure
            if (!data.questions || !Array.isArray(data.questions)) {
                throw new Error('Invalid JSON structure');
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

            return {
                success: true,
                title: data.title || data.exam_title || 'Đề thi',
                questions
            };

        } catch (error: any) {
            console.warn(`Model ${modelName} failed:`, error.message);

            // Nếu là lỗi quota hoặc rate limit, thử model tiếp theo
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                continue;
            }

            // Nếu là lỗi JSON parse, thử lại
            if (error instanceof SyntaxError) {
                continue;
            }

            // Lỗi khác, try next model
            continue;
        }
    }

    return {
        success: false,
        error: 'Không thể phân tích đề thi. Vui lòng kiểm tra API Key hoặc thử lại sau.'
    };
}
