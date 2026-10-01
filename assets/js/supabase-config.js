/* Supabase 연결 설정 (대시보드 → Project Settings → Data API) */
window.SUPABASE_URL = "https://whtzinrjezepvkosayjt.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodHppbnJqZXplcHZrb3NheWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTExMDEsImV4cCI6MjEwNTE4NzEwMX0.qcW8UfH1iAlNsbZcXFn7WKk8rvft6GGsHFxp6AI310Y";

/* 공용 클라이언트 (auth.js, community.js 등에서 window.sb 로 사용) */
window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
