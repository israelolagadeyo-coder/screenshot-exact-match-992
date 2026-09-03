import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, X, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataPreviewTable, type PreviewColumn } from "./DataPreviewTable";
import { DataHealthSummary } from "./DataHealthSummary";
import { ColumnMapper } from "./ColumnMapper";
import {
  autoMap,
  cleanAndValidate,
  isSupportedFile,
  parseFile,
  type ColumnMapping,
  type ParsedFile,
} from "@/lib/data-parsing";
import {
  DATASET_KIND_DESCRIPTIONS,
  DATASET_KIND_LABELS,
  saveDataset,
  schemaFor,
  type DatasetKind,
} from "@/lib/datasets";
import { cn } from "@/lib/utils";

const KINDS: DatasetKind[] = ["sales", "customers", "expenses"];

interface UploadWizardProps {
  organizationId: string;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}

type Step = "select" | "review";

export function UploadWizard({ organizationId, userId, onDone, onCancel }: UploadWizardProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [kind, setKind] = useState<DatasetKind>("sales");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => schemaFor(kind), [kind]);

  const validation = useMemo(() => {
    if (!parsed) return null;
    return cleanAndValidate(parsed.rows, fields, mapping);
  }, [parsed, fields, mapping]);

  const previewColumns: PreviewColumn[] = useMemo(
    () => fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
    [fields],
  );

  const requiredUnmapped = fields.filter((f) => f.required && !mapping[f.key]);

  const handleFile = useCallback(
    async (picked: File) => {
      if (!isSupportedFile(picked)) {
        toast.error("Unsupported file. Please upload a .csv or .xlsx file.");
        return;
      }
      setFile(picked);
      if (!name) setName(picked.name.replace(/\.[^.]+$/, ""));
      setParsing(true);
      try {
        const result = await parseFile(picked);
        if (result.rows.length === 0) {
          toast.error("That file has no data rows.");
          setParsing(false);
          return;
        }
        setParsed(result);
        setMapping(autoMap(schemaFor(kind), result.columns));
        setStep("review");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that file.");
      } finally {
        setParsing(false);
      }
    },
    [kind, name],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void handleFile(dropped);
  };

  const reMap = (nextKind: DatasetKind) => {
    setKind(nextKind);
    if (parsed) setMapping(autoMap(schemaFor(nextKind), parsed.columns));
  };

  const handleSave = async () => {
    if (!file || !parsed || !validation) return;
    if (requiredUnmapped.length > 0) {
      toast.error(`Map all required fields: ${requiredUnmapped.map((f) => f.label).join(", ")}.`);
      return;
    }
    if (!name.trim()) {
      toast.error("Give this dataset a name.");
      return;
    }
    setSaving(true);
    try {
      await saveDataset({
        organizationId,
        userId,
        name: name.trim(),
        kind,
        file,
        sourceColumns: parsed.columns,
        mapping,
        cleanedRows: validation.cleanedRows,
        health: validation.health,
      });
      await queryClient.invalidateQueries({ queryKey: ["datasets", organizationId] });
      toast.success("Dataset processed and saved.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't save this dataset.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Step: select ----
  if (step === "select") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="dataset-kind">What kind of data is this?</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as DatasetKind)}>
            <SelectTrigger id="dataset-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {DATASET_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{DATASET_KIND_DESCRIPTIONS[kind]}</p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background/50 px-6 py-12 text-center transition-colors hover:border-primary/60 hover:bg-accent/40",
            dragging && "border-primary bg-accent/60",
          )}
        >
          {parsing ? (
            <Loader2 className="size-8 animate-spin text-primary" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="size-6" />
            </span>
          )}
          <span className="text-sm font-medium">
            {parsing ? "Reading your file…" : "Drag & drop or click to upload"}
          </span>
          <span className="text-xs text-muted-foreground">CSV or XLSX, up to 20,000 rows</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void handleFile(picked);
              e.target.value = "";
            }}
          />
        </button>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ---- Step: review ----
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep("select");
            setParsed(null);
            setFile(null);
          }}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm">
          <FileSpreadsheet className="size-4 text-primary" />
          <span className="max-w-[180px] truncate font-medium">{file?.name}</span>
          <button
            type="button"
            onClick={() => {
              setStep("select");
              setParsed(null);
              setFile(null);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dataset-name">Dataset name</Label>
          <Input
            id="dataset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q1 sales export"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataset-kind-review">Dataset type</Label>
          <Select value={kind} onValueChange={(v) => reMap(v as DatasetKind)}>
            <SelectTrigger id="dataset-kind-review">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {DATASET_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="panel space-y-4 p-5">
        <h3 className="font-display text-base font-semibold">Map columns</h3>
        <ColumnMapper fields={fields} columns={parsed?.columns ?? []} mapping={mapping} onChange={setMapping} />
      </div>

      {validation && (
        <div className="panel p-5">
          <DataHealthSummary health={validation.health} />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Preview</h3>
          <span className="text-xs text-muted-foreground">
            Cleaned & validated against the {DATASET_KIND_LABELS[kind]} schema
          </span>
        </div>
        {validation && (
          <DataPreviewTable
            columns={previewColumns}
            rows={validation.cleanedRows}
            issues={validation.issues}
          />
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 py-4 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {requiredUnmapped.length > 0
            ? `Map required fields: ${requiredUnmapped.map((f) => f.label).join(", ")}`
            : "All required fields mapped."}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || requiredUnmapped.length > 0}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Processing…
              </>
            ) : (
              "Process & save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
