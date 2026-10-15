-- Delivery receipts: the recipient's device stamps delivered_at when a message arrives.
-- (sent = on server, delivered = reached the recipient's device, read = opened)
alter table public.messages add column if not exists delivered_at timestamptz;

-- The recipient may update only the receipt columns, never body / sender / time.
revoke update on public.messages from anon, authenticated;
grant update (read_at, delivered_at) on public.messages to authenticated;
