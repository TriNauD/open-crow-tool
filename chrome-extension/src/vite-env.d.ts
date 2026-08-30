/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 与 Web 端 `NEXT_PUBLIC_SUPABASE_URL` 一致；用于划词侧 refresh 时补齐 storage */
  readonly VITE_PUBLIC_SUPABASE_URL: string;
  /** 与 Web 端 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 一致 */
  readonly VITE_PUBLIC_SUPABASE_ANON_KEY: string;
  /** 与 Web 站点 origin 一致（无尾斜杠）；扩展内登录后的默认 apiBaseUrl，
   *  也是未连接时公开解释的兜底域；不设置则默认生产域 https://www.crowknows.tech */
  readonly VITE_PUBLIC_SITE_ORIGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
