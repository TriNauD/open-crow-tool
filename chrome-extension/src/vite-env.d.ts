/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 与 Web 端 `NEXT_PUBLIC_SUPABASE_URL` 一致；用于划词侧 refresh 时补齐 storage */
  readonly VITE_PUBLIC_SUPABASE_URL: string;
  /** 与 Web 端 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 一致 */
  readonly VITE_PUBLIC_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
