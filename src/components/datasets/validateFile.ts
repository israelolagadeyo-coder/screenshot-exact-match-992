import { getFileType } from "@/lib/datasets/parse";

export function validateFile(file: File): string | null {
  const type = getFileType(file.name);
  if (!type) {
    return "Unsupported file type. Please upload a .csv or .xlsx file.";
  }
  if (file.size > 50 * 1024 * 1024) {
    return "File is too large. Maximum size is 50 MB.";
  }
  if (file.size === 0) {
    return "File appears to be empty.";
  }
  return null;
}
