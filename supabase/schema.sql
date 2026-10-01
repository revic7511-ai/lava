-- ============================================================
-- 회원 프로필 테이블 (Supabase Auth 연동)
-- Supabase 대시보드 → SQL Editor → New query 에서 전체 실행
-- ============================================================

-- 1) profiles 테이블
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,                       -- 이름(별명)
  school      text,                       -- 마이스터고 학교명
  cohort      int,                        -- 몇 기
  grade       int check (grade between 1 and 3),  -- 학년
  department  text,                       -- 과(전공)
  created_at  timestamptz not null default now()
);

-- 2) 행 수준 보안(RLS): 자기 자신의 프로필만 접근 가능
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 3) 회원가입 시 user_metadata → profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, school, cohort, grade, department)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'school',
    (new.raw_user_meta_data->>'cohort')::int,
    (new.raw_user_meta_data->>'grade')::int,
    new.raw_user_meta_data->>'department'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4) 커뮤니티 게시글 (누구나 읽기·쓰기, 글쓴이 학교정보 필수)
--    - 로그인 회원이 쓴 글은 author_id가 기록되어 본인 글 삭제 가능
--    - 비회원 글은 author_id 없음(삭제 불가)
-- ============================================================
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references auth.users(id) on delete cascade,
  author_name text,                       -- 회원 이름(로그인 시 기록)
  title       text not null,
  content     text not null,
  school      text,                       -- 마이스터고 학교명 (필수)
  cohort      int,                        -- 몇 기 (필수)
  grade       int check (grade between 1 and 3),  -- 학년 (필수)
  department  text,                       -- 과 (필수)
  created_at  timestamptz not null default now()
);

-- 이전 버전으로 만든 테이블 마이그레이션 (재실행 안전)
alter table public.posts alter column author_id drop not null;
alter table public.posts add column if not exists school text;
alter table public.posts add column if not exists cohort int;
alter table public.posts add column if not exists grade int;
alter table public.posts add column if not exists department text;

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts
  for select using (true);

-- 비회원도 글쓰기 가능
drop policy if exists "posts_insert_auth" on public.posts;
drop policy if exists "posts_insert_all" on public.posts;
create policy "posts_insert_all" on public.posts
  for insert with check (true);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = author_id);

-- ============================================================
-- 5) 댓글 (누구나 읽기, 회원만 작성, 본인 댓글만 삭제)
-- ============================================================
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name text,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments
  for select using (true);

drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth" on public.comments
  for insert with check (auth.uid() = author_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = author_id);
