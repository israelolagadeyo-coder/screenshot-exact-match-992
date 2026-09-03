import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";
import heroImage from "@/assets/hero-dashboard.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "BizIntel AI — Turn Business Data Into Better Decisions" },
      {
        name: "description",
        content:
          "BizIntel AI turns your Excel and CSV business data into intelligent dashboards, clear insights and actionable recommendations.",
      },
      { property: "og:title", content: "BizIntel AI — Turn Business Data Into Better Decisions" },
      {
        property: "og:description",
        content:
          "Upload your business data. Understand your business. Make better decisions with an AI business analyst grounded in your numbers.",
      },
    ],
  }),
});

const problems = [
  {
    title: "Data sits in spreadsheets",
    body: "Sales, expenses and customer records live in files nobody analyses.",
  },
  {
    title: "Reporting takes days",
    body: "Manual pivot tables and copy-paste charts before every management meeting.",
  },
  {
    title: "Decisions run on instinct",
    body: "Pricing, stock and marketing calls get made without evidence.",
  },
  {
    title: "Nobody explains the numbers",
    body: "You can see revenue fell. You still don't know which product or customer caused it.",
  },
];

const steps = [
  { n: "01", t: "Upload", d: "Drop in your CSV or Excel sales, customer and expense files." },
  { n: "02", t: "Analyse", d: "Data is validated, cleaned and stored in a structured warehouse." },
  { n: "03", t: "Understand", d: "Dashboards and analytics calculate your real metrics." },
  { n: "04", t: "Decide", d: "The AI analyst explains the facts and recommends next actions." },
];

const features = [
  { t: "Clean data pipeline", d: "Validation, type detection, duplicate and missing-value checks on every upload." },
  { t: "Executive dashboard", d: "Revenue, growth, orders, customers and average order value at a glance." },
  { t: "Deep analytics", d: "Product, customer, expense and growth analysis with period comparisons." },
  { t: "AI business analyst", d: "Ask questions in plain English and get evidence-backed answers." },
  { t: "Multi-business workspaces", d: "Run several businesses with isolated data and team roles." },
  { t: "Reports", d: "Generate structured business performance reports for your team or board." },
];

const industries = [
  "Retail & E-commerce",
  "Wholesale & Distribution",
  "Manufacturing",
  "Hospitality & Food",
  "Professional Services",
  "Education",
  "Healthcare",
  "Logistics",
];

const faqs = [
  {
    q: "What data do I need to get started?",
    a: "A simple sales export with date, product, quantity and revenue is enough. You can add customer and expense files later.",
  },
  {
    q: "Where does the AI get its numbers from?",
    a: "The analytics engine calculates every figure from your stored data. The AI only explains those calculated facts — it never invents numbers.",
  },
  {
    q: "Is my business data private?",
    a: "Yes. Each business is isolated with row-level security, and uploaded files are stored privately with authenticated access only.",
  },
  {
    q: "Do I need a data analyst on my team?",
    a: "No. BizIntel AI is built for owners and managers. If you can export a spreadsheet, you can use it.",
  },
];

function Landing() {
  const { session } = useAuth();
  const appHref = session ? "/dashboard" : "/signup";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#analyst" className="transition-colors hover:text-foreground">AI Analyst</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to={appHref}>Get Started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="gradient-ink relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Upload → Analyse → Understand → Decide
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-ink-foreground sm:text-5xl lg:text-6xl">
                Turn Your Business Data Into{" "}
                <span className="gradient-text-accent">Better Decisions</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-muted">
                BizIntel AI transforms your Excel and CSV business data into intelligent dashboards,
                clear insights and actionable recommendations.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={appHref}>Get Started</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-ink-muted/40 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
                >
                  <a href="#how">See How It Works</a>
                </Button>
              </div>
              <p className="mt-6 text-sm text-ink-muted">
                No credit card required · Your data stays private
              </p>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="BizIntel AI analytics dashboard with revenue trend and product performance charts"
                width={1600}
                height={1000}
                className="w-full rounded-2xl border border-ink-muted/20 shadow-elevated"
              />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">
            Most businesses collect data. Very few understand it.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problems.map((p) => (
              <div key={p.title} className="panel p-6">
                <h3 className="text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-secondary/50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold sm:text-4xl">How BizIntel AI works</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Raw data becomes clean data, clean data becomes analytics, analytics becomes
              intelligence — and only then does the AI speak.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-4">
              {steps.map((s) => (
                <li key={s.n} className="panel p-6">
                  <span className="font-display text-sm font-bold text-primary">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Everything a growing business needs</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.t} className="panel p-6">
                <h3 className="text-base font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI analyst */}
        <section id="analyst" className="surface-ink py-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-ink-foreground sm:text-4xl">
                An AI business analyst that never invents numbers
              </h2>
              <p className="mt-4 text-ink-muted">
                The analytics engine calculates the facts. The AI explains them — separating what is
                known, what is inferred, and what simply cannot be determined from your data.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-ink-muted">
                {[
                  "Why did revenue fall last month?",
                  "Which customers generate the most revenue?",
                  "What are my best and worst performing products?",
                  "What should I focus on next month?",
                ].map((q) => (
                  <li key={q} className="rounded-lg border border-ink-muted/20 px-4 py-3">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-ink-muted/20 bg-background/95 p-6 text-foreground shadow-elevated">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Finding</p>
              <p className="mt-1 text-sm">Revenue grew month over month, driven by one product line.</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">Evidence</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculated from your uploaded transactions — never estimated.
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-primary">Recommendation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Concrete next actions tied to the evidence above.
              </p>
            </div>
          </div>
        </section>

        {/* Dashboard preview */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Your business, on one screen</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            KPIs, revenue trends, product and customer performance — all calculated from your own
            uploaded data.
          </p>
          <img
            src={heroImage}
            alt="Preview of the BizIntel AI overview dashboard"
            loading="lazy"
            width={1600}
            height={1000}
            className="mt-10 w-full rounded-2xl border border-border shadow-elevated"
          />
        </section>

        {/* Industries */}
        <section className="border-y border-border bg-secondary/50 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold sm:text-4xl">Built for every kind of business</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {industries.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA */}
        <section className="gradient-ink">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <h2 className="text-3xl font-bold text-ink-foreground sm:text-4xl">
              Understand Your Business. Make Better Decisions.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-muted">
              Create your workspace, upload your first dataset and see your business clearly.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to={appHref}>Get Started</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-2 text-sm text-muted-foreground">
              Understand Your Business. Make Better Decisions.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} BizIntel AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
