import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "缺少环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请检查 .env 文件或 Vercel 环境变量设置"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
