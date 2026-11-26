-- The bank deducts source tax and the Central Fund share from export proceeds. Amounts are kept per
-- order so a later change in rates never rewrites what was actually deducted.
alter table orders add column if not exists source_tax double precision;
alter table orders add column if not exists central_fund double precision;

-- The December 2023 wage gazette has four worker grades. Factories still on the built-in grade table
-- move anyone on the old fifth grade to the entry grade; a factory with its own table is left alone.
update employees
set grade = 4
where grade > 4
  and not exists (select 1 from settings where key = 'payroll');
