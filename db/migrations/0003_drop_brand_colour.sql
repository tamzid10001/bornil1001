-- Brand colour was removed; every factory uses the built-in palette.
alter table factory drop column if exists accent;
