// Tài khoản VIP Giáo viên - Format: username:password:name
export const VIP_ACCOUNTS = [
    "admin:admin123:Quản trị viên",
    "gv01:123456:Nguyễn Văn A",
    "gv02:123456:Trần Thị B"
];

// Hàm kiểm tra đăng nhập
export function verifyTeacherLogin(username: string, password: string): { name: string } | null {
    for (const acc of VIP_ACCOUNTS) {
        const [u, p, name] = acc.split(':');
        if (u === username.toLowerCase() && p === password) {
            return { name };
        }
    }
    return null;
}

export function saveTeacherSession(account: { name: string }): void {
    localStorage.setItem('teacherSession', JSON.stringify(account));
}

export function getTeacherSession(): { name: string } | null {
    const s = localStorage.getItem('teacherSession');
    return s ? JSON.parse(s) : null;
}

export function logoutTeacher(): void {
    localStorage.removeItem('teacherSession');
}

export function isTeacherLoggedIn(): boolean {
    return !!localStorage.getItem('teacherSession');
}
