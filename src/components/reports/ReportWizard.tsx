import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildRange } from "@/lib/analytics/dates";
import type { DateRangePresetKey } from "@/lib/analytics/types";
import { useDatasets } from "@/lib/datasets/queries";
import { generateReport } from "@/lib/reports/reports.functions";
import { REPORT_TYPES, type ReportType } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const PERIODS: DateRangePresetKey[] = [
  "last7",
  "last30",
  "last90",
  "this_month",
  "prev_month",
  "this_quarter",
  "prev_quarter",
  "this_year",
  "prev_year",
  "all",
];

export function ReportWizard({
  organizationId,
  canGenerate,
  open,
  onOpenChange,
  initial,
}: {
  organizationId: string;
  canGenerate: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { reportType: ReportType; periodKey: string; includeAi: boolean } | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const datasets = useDatasets(organizationId);

  const [step, setStep] = useState(0);
  const [reportType, setReportType] = useState<ReportType>(initial?.reportType ?? "executive");
  const [periodKey, setPeriodKey] = useState<string>(initial?.periodKey ?? "last30");
  const [includeAi, setIncludeAi] = useState(initial?.includeAi ?? true);

  const relevantDatasets = useMemo(() => {
    const rows = datasets.data ?? [];
    if (reportType === "expenses") return rows.filter((d) => d.dataset_type === "expenses");
    if (reportType === "customers") return rows.filter((d) => d.dataset_type !== "expenses");
    return rows.filter((d) => d.dataset_type !== "expenses" || reportType === "executive");
  }, [datasets.data, reportType]);

  const mutation = useMutation({
    mutationFn: () =>
      generateReport({ data: { organizationId, reportType, periodKey, includeAi } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["reports", organizationId] });
      onOpenChange(false);
      setStep(0);
      toast.success("Your report is ready.");
      navigate({ to: "/dashboard/reports/$reportId", params: { reportId: result.reportId } });
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't generate that report."),
  });

  const steps = ["Report type", "Period", "Data", "AI analysis", "Generate"];

  return (
    <Dialog open={open} onOpenChange={(next) => (mutation.isPending ? null : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate a business report</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length} — {steps[step]}
          </DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setReportType(type.key)}
                aria-pressed={reportType === type.key}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  reportType === type.key ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                )}
              >
                <p className="font-medium">{type.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <Label htmlFor="report-period">Reporting period</Label>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger id="report-period" className="w-full">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {buildRange(key).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Figures are calculated for this window, and compared with the previous window of the same length
              where one exists.
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These uploaded files will be used for this report. Reports always read your latest processed data.
            </p>
            {datasets.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading your files…</p>
            ) : relevantDatasets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No relevant data was found for this report type. You can still generate it — the report will state
                clearly what is unavailable.
              </p>
            ) : (
              <ul className="space-y-2">
                {relevantDatasets.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">
                      {d.row_count.toLocaleString()} rows · {d.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <Label htmlFor="include-ai" className="text-base">
                Include AI business analysis
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                The analyst explains what your numbers mean. It only uses figures calculated from your data, and
                says clearly when something cannot be determined.
              </p>
            </div>
            <Switch id="include-ai" checked={includeAi} onCheckedChange={setIncludeAi} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Report:</span>{" "}
              {REPORT_TYPES.find((t) => t.key === reportType)?.label}
            </p>
            <p>
              <span className="text-muted-foreground">Period:</span>{" "}
              {buildRange(periodKey as DateRangePresetKey).label}
            </p>
            <p>
              <span className="text-muted-foreground">AI analysis:</span> {includeAi ? "Included" : "Not included"}
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
            disabled={mutation.isPending}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canGenerate}
            >
              {mutation.isPending ? "Generating…" : "Generate Business Report"}
            </Button>
          )}
        </DialogFooter>
        {!canGenerate ? (
          <p className="text-sm text-muted-foreground">
            Your role can view and download reports, but not create them.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
