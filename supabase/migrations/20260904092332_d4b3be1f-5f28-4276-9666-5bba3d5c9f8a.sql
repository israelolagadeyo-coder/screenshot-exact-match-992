create or replace function public.safe_num(v text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare cleaned text;
begin
  if v is null then return null; end if;
  cleaned := regexp_replace(v, '[^0-9eE\.\-\+]', '', 'g');
  if cleaned = '' then return null; end if;
  return cleaned::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.safe_day(v text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  return (btrim(v))::date;
exception when others then
  return null;
end;
$$;

create or replace function public.analytics_rows(_org uuid)
returns table (
  dataset_id uuid,
  dataset_type text,
  occurred_on date,
  product text,
  customer text,
  category text,
  quantity numeric,
  revenue numeric,
  expense numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id,
    coalesce(d.dataset_type, 'unknown') as dataset_type,
    public.safe_day(r.data ->> (d.column_mapping ->> 'date')) as occurred_on,
    nullif(btrim(coalesce(r.data ->> (d.column_mapping ->> 'product'), '')), '') as product,
    nullif(btrim(coalesce(
      r.data ->> (d.column_mapping ->> 'customer'),
      r.data ->> (d.column_mapping ->> 'customer_name'),
      r.data ->> (d.column_mapping ->> 'customer_id'),
      '')), '') as customer,
    nullif(btrim(coalesce(r.data ->> (d.column_mapping ->> 'category'), '')), '') as category,
    case when coalesce(d.dataset_type,'') = 'sales'
      then public.safe_num(r.data ->> (d.column_mapping ->> 'quantity')) end as quantity,
    case
      when coalesce(d.dataset_type,'') = 'sales' then coalesce(
        public.safe_num(r.data ->> (d.column_mapping ->> 'revenue')),
        public.safe_num(r.data ->> (d.column_mapping ->> 'quantity'))
          * public.safe_num(r.data ->> (d.column_mapping ->> 'unit_price'))
      )
      when coalesce(d.dataset_type,'') = 'customers'
        then public.safe_num(r.data ->> (d.column_mapping ->> 'purchase'))
    end as revenue,
    case when coalesce(d.dataset_type,'') = 'expenses'
      then public.safe_num(r.data ->> (d.column_mapping ->> 'amount')) end as expense
  from public.dataset_rows r
  join public.datasets d on d.id = r.dataset_id
  where r.organization_id = _org
    and d.organization_id = _org
    and d.status = 'processed';
$$;

grant execute on function public.analytics_rows(uuid) to authenticated;
grant execute on function public.safe_num(text) to authenticated;
grant execute on function public.safe_day(text) to authenticated;

create or replace function public.analytics_coverage(_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'minDate', min(occurred_on),
    'maxDate', max(occurred_on),
    'salesRows', count(*) filter (where dataset_type = 'sales'),
    'expenseRows', count(*) filter (where dataset_type = 'expenses'),
    'customerRows', count(*) filter (where dataset_type = 'customers'),
    'rowsWithDate', count(*) filter (where occurred_on is not null),
    'rowsWithRevenue', count(*) filter (where revenue is not null),
    'rowsWithProduct', count(*) filter (where product is not null),
    'rowsWithCustomer', count(*) filter (where customer is not null),
    'totalRows', count(*),
    'hasSales', coalesce(bool_or(dataset_type = 'sales'), false),
    'hasExpenses', coalesce(bool_or(dataset_type = 'expenses'), false),
    'hasCustomers', coalesce(bool_or(customer is not null), false),
    'hasProducts', coalesce(bool_or(product is not null), false)
  )
  from public.analytics_rows(_org);
$$;

grant execute on function public.analytics_coverage(uuid) to authenticated;

create or replace function public.analytics_period(_org uuid, _from date, _to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with r as (
    select * from public.analytics_rows(_org)
    where occurred_on is not null
      and (_from is null or occurred_on >= _from)
      and (_to is null or occurred_on <= _to)
  ),
  first_seen as (
    select customer, min(occurred_on) as first_day
    from public.analytics_rows(_org)
    where customer is not null and occurred_on is not null
    group by customer
  ),
  cust as (
    select
      count(distinct r.customer) as customers,
      count(distinct r.customer) filter (
        where f.first_day >= coalesce(_from, f.first_day)
      ) as new_customers
    from r left join first_seen f on f.customer = r.customer
    where r.customer is not null
  )
  select jsonb_build_object(
    'revenue', coalesce((select sum(revenue) from r where dataset_type = 'sales'), 0),
    'transactions', (select count(*) from r where dataset_type = 'sales'),
    'units', coalesce((select sum(quantity) from r where dataset_type = 'sales'), 0),
    'expenses', coalesce((select sum(expense) from r where dataset_type = 'expenses'), 0),
    'expenseEntries', (select count(*) from r where dataset_type = 'expenses'),
    'customers', coalesce((select customers from cust), 0),
    'newCustomers', coalesce((select new_customers from cust), 0),
    'products', (select count(distinct product) from r where product is not null),
    'days', (select count(distinct occurred_on) from r),
    'periodStart', _from,
    'periodEnd', _to
  );
$$;

grant execute on function public.analytics_period(uuid, date, date) to authenticated;

create or replace function public.analytics_trend(_org uuid, _from date, _to date, _grain text)
returns table (
  bucket date,
  revenue numeric,
  transactions bigint,
  units numeric,
  expenses numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc(
      case when _grain in ('day','week','month','quarter','year') then _grain else 'day' end,
      occurred_on::timestamp
    )::date as bucket,
    coalesce(sum(revenue) filter (where dataset_type = 'sales'), 0) as revenue,
    count(*) filter (where dataset_type = 'sales') as transactions,
    coalesce(sum(quantity) filter (where dataset_type = 'sales'), 0) as units,
    coalesce(sum(expense) filter (where dataset_type = 'expenses'), 0) as expenses
  from public.analytics_rows(_org)
  where occurred_on is not null
    and (_from is null or occurred_on >= _from)
    and (_to is null or occurred_on <= _to)
  group by 1
  order by 1;
$$;

grant execute on function public.analytics_trend(uuid, date, date, text) to authenticated;

create or replace function public.analytics_top_products(_org uuid, _from date, _to date, _limit int, _ascending boolean default false)
returns table (name text, revenue numeric, units numeric, transactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    product as name,
    coalesce(sum(revenue), 0) as revenue,
    coalesce(sum(quantity), 0) as units,
    count(*) as transactions
  from public.analytics_rows(_org)
  where product is not null
    and dataset_type = 'sales'
    and (occurred_on is null or (
      (_from is null or occurred_on >= _from) and (_to is null or occurred_on <= _to)))
  group by product
  order by case when _ascending then coalesce(sum(revenue), 0) end asc nulls last,
           case when _ascending then null else coalesce(sum(revenue), 0) end desc nulls last
  limit coalesce(_limit, 10);
$$;

grant execute on function public.analytics_top_products(uuid, date, date, int, boolean) to authenticated;

create or replace function public.analytics_top_customers(_org uuid, _from date, _to date, _limit int)
returns table (name text, revenue numeric, transactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    customer as name,
    coalesce(sum(revenue), 0) as revenue,
    count(*) as transactions
  from public.analytics_rows(_org)
  where customer is not null
    and (occurred_on is null or (
      (_from is null or occurred_on >= _from) and (_to is null or occurred_on <= _to)))
  group by customer
  order by coalesce(sum(revenue), 0) desc nulls last
  limit coalesce(_limit, 10);
$$;

grant execute on function public.analytics_top_customers(uuid, date, date, int) to authenticated;

create or replace function public.analytics_expense_categories(_org uuid, _from date, _to date, _limit int)
returns table (name text, amount numeric, entries bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(category, 'Uncategorised') as name,
    coalesce(sum(expense), 0) as amount,
    count(*) as entries
  from public.analytics_rows(_org)
  where dataset_type = 'expenses'
    and (occurred_on is null or (
      (_from is null or occurred_on >= _from) and (_to is null or occurred_on <= _to)))
  group by 1
  order by 2 desc
  limit coalesce(_limit, 12);
$$;

grant execute on function public.analytics_expense_categories(uuid, date, date, int) to authenticated;