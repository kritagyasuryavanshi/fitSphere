-- M4-10: an enrollment a coach assigned to a paid client ends with the coaching. Its own file: a new enum value cannot
-- be used in the transaction that adds it.
alter type public.enrollment_status add value if not exists 'ended';
