import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { UploadProgress } from "@/lib/datasets/api";

type UploadZoneProps = {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  onDismissError: () => void;
};

const ACCEPTED = ".csv,.xlsx,.xls";

export function UploadZone({
  onFileSelected,
  uploading,
  progress,
  error,
  onDismissError,
}: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFileSelected(files[0]!);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all",
          dragging
            ? "border-primary bg-accent/50"
            : "border-border hover:border-primary/50 hover:bg-accent/30",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">{progress?.stage ?? "Processing..."}</p>
            <Progress value={progress?.percent ?? 0} />
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium">Drag and drop your file here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse — CSV or Excel (.xlsx) files up to 50 MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <button
            onClick={onDismissError}
            className="text-destructive/60 transition-colors hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
