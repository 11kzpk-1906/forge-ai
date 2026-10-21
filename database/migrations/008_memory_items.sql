-- ForgeAI
-- Migration 008: Persistent user memory

create table if not exists public.memory_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 160),
    content text not null check (char_length(content) between 1 and 12000),
    tags text[] not null default '{}',
    source_conversation_id uuid references public.conversations(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists memory_items_user_updated_at_idx
    on public.memory_items(user_id, updated_at desc);

create index if not exists memory_items_tags_idx
    on public.memory_items using gin(tags);

alter table public.memory_items enable row level security;

drop policy if exists "Users can view their own memories" on public.memory_items;
create policy "Users can view their own memories"
    on public.memory_items for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own memories" on public.memory_items;
create policy "Users can create their own memories"
    on public.memory_items for insert to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own memories" on public.memory_items;
create policy "Users can update their own memories"
    on public.memory_items for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own memories" on public.memory_items;
create policy "Users can delete their own memories"
    on public.memory_items for delete to authenticated
    using ((select auth.uid()) = user_id);
