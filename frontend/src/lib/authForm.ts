import { ApiError } from "@/lib/apiClient";

const DEFAULT_LANDING = "/dashboard";

/** Same-origin relative paths only; anything else falls back to the dashboard. */
export function safeRedirectPath(redirect: string | null): string {
  if (!redirect || !redirect.startsWith("/")) return DEFAULT_LANDING;
  // Browsers treat "/\" like "//", and strip tab/newline from URLs.
  if (redirect.startsWith("//") || /[\\\u0000-\u001f]/.test(redirect)) return DEFAULT_LANDING;
  return redirect;
}

export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (err.status === 429) return "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    if (err.status === 400) return "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง";
  }
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export function registerErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "อีเมลนี้ถูกใช้งานแล้ว";
    if (err.status === 429) return "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    if (err.status === 400) return "ข้อมูลไม่ถูกต้อง รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  }
  return "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}
