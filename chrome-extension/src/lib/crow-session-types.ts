/**
 * CrowAuth 纯类型（无 chrome 依赖）。
 * 网站侧 tsconfig 排除 chrome-extension 目录，但被 import 的文件仍会进入网站类型
 * 检查程序，因此被根目录 Vitest 测试引用的模块链上不得出现 chrome 全局——
 * 类型单独放这里，实现（chrome.storage 读写）留在 crow-session.ts。
 */
export type CrowAuth = {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  expiresAt: number | undefined;
};
