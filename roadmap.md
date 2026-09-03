# BizIntel AI — build roadmap

## Phase 1 — foundation (done)
- [x] Design system (ink navy + emerald tokens, Space Grotesk / DM Sans)
- [x] Landing page (hero, problem, how it works, features, AI analyst, preview, industries, FAQ, CTA, footer)
- [x] Auth: /login, /signup, /forgot-password, /reset-password, Google sign-in, session persistence
- [x] Database: profiles, organizations, organization_members + roles enum + RLS + grants
- [x] Onboarding: Create Your Business (name, industry, country, currency, logo)
- [x] Dashboard shell: sidebar (Overview, Data, Analytics, AI Analyst, Reports, Settings) + Coming Soon items
- [x] Settings: business details, account profile/password, members list

## Phase 2 — data pipeline
- [ ] CSV/XLSX upload to private storage bucket `datasets`
- [ ] Column detection, spreadsheet preview, validation, cleaning
- [ ] datasets / dataset_columns / transactions / customers / products tables
- [ ] Dataset health panel

## Phase 3 — analytics engine
- [ ] Server-side aggregations: revenue, sales, products, customers, expenses
- [ ] KPI cards on Overview, analytics charts, period comparison

## Phase 4 — AI business analyst
- [ ] Controlled analytics tools, chat, conversation history, evidence-based answers

## Phase 5 — reports & hardening
- [ ] Business performance report, PDF module, performance and security review
