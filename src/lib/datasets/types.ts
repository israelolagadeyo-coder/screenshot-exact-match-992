export type ColumnType = "date" | "number" | "text" | "boolean";

export type DetectedColumn = {
  name: string;
  type: ColumnType;
  sample: string | number | boolean | null;
  missing: number;
  unique: number;
  values: (string | number | boolean | null)[];
};

export type ParsedFile = {
  columns: DetectedColumn[];
  rows: Record<string, string | number | boolean | null>[];
  rowCount: number;
  columnCount: number;
};

export type ValidationIssue = {
  type: "missing" | "duplicate" | "invalid_date" | "invalid_number" | "missing_required";
  column: string;
  rowIndex: number;
  message: string;
  value: string | null;
};

export type ValidationSummary = {
  missingValues: number;
  duplicates: number;
  invalidDates: number;
  invalidNumbers: number;
  missingRequired: number;
  healthScore: number;
  issues: ValidationIssue[];
};

export type CleaningSummary = {
  removedDuplicates: number;
  trimmedWhitespace: number;
  normalizedDates: number;
  removedEmptyRows: number;
  totalFixes: number;
};

export type DatasetType = "sales" | "customers" | "expenses" | "unknown";

export type StandardField = {
  key: string;
  label: string;
  required: boolean;
  type: ColumnType;
  aliases: string[];
};

export type ColumnMapping = Record<string, string>;

export type DatasetStatus =
  | "uploading"
  | "uploaded"
  | "parsing"
  | "parsed"
  | "validating"
  | "validated"
  | "cleaning"
  | "cleaned"
  | "mapping"
  | "processed"
  | "error";

export const DATASET_SCHEMAS: Record<Exclude<DatasetType, "unknown">, StandardField[]> = {
  sales: [
    {
      key: "date",
      label: "Date",
      required: true,
      type: "date",
      aliases: [
        "date",
        "transaction_date",
        "order_date",
        "sale_date",
        "created_at",
        "txn_date",
        "dt",
      ],
    },
    {
      key: "product",
      label: "Product",
      required: false,
      type: "text",
      aliases: ["product", "product_name", "item", "item_name", "sku", "product_id"],
    },
    {
      key: "customer",
      label: "Customer",
      required: false,
      type: "text",
      aliases: ["customer", "customer_name", "client", "client_name", "buyer", "customer_id"],
    },
    {
      key: "quantity",
      label: "Quantity",
      required: true,
      type: "number",
      aliases: ["quantity", "qty", "units", "count", "amount_sold", "volume"],
    },
    {
      key: "unit_price",
      label: "Unit Price",
      required: false,
      type: "number",
      aliases: ["unit_price", "price", "price_per_unit", "rate", "cost_per_unit", "selling_price"],
    },
    {
      key: "revenue",
      label: "Revenue",
      required: true,
      type: "number",
      aliases: [
        "revenue",
        "total",
        "total_revenue",
        "amount",
        "sales_amount",
        "gross",
        "line_total",
        "subtotal",
      ],
    },
  ],
  customers: [
    {
      key: "customer_id",
      label: "Customer ID",
      required: true,
      type: "text",
      aliases: ["customer_id", "id", "cust_id", "client_id", "customer_no"],
    },
    {
      key: "customer_name",
      label: "Customer Name",
      required: true,
      type: "text",
      aliases: ["customer_name", "name", "customer", "client_name", "client", "full_name"],
    },
    {
      key: "date",
      label: "Date",
      required: false,
      type: "date",
      aliases: [
        "date",
        "signup_date",
        "join_date",
        "created_at",
        "registration_date",
        "first_purchase",
      ],
    },
    {
      key: "location",
      label: "Location",
      required: false,
      type: "text",
      aliases: ["location", "city", "address", "region", "country", "state", "area"],
    },
    {
      key: "purchase",
      label: "Purchase",
      required: false,
      type: "number",
      aliases: [
        "purchase",
        "purchase_amount",
        "total_purchased",
        "spent",
        "total_spent",
        "lifetime_value",
        "ltv",
        "value",
      ],
    },
  ],
  expenses: [
    {
      key: "date",
      label: "Date",
      required: true,
      type: "date",
      aliases: ["date", "expense_date", "transaction_date", "paid_on", "created_at", "dt"],
    },
    {
      key: "category",
      label: "Category",
      required: true,
      type: "text",
      aliases: ["category", "type", "expense_type", "expense_category", "classification", "tag"],
    },
    {
      key: "description",
      label: "Description",
      required: false,
      type: "text",
      aliases: [
        "description",
        "desc",
        "details",
        "note",
        "notes",
        "memo",
        "particulars",
        "narration",
      ],
    },
    {
      key: "amount",
      label: "Amount",
      required: true,
      type: "number",
      aliases: ["amount", "cost", "value", "expense_amount", "total", "price", "paid"],
    },
  ],
};

export const DATASET_TYPE_LABELS: Record<DatasetType, string> = {
  sales: "Sales",
  customers: "Customers",
  expenses: "Expenses",
  unknown: "Unknown",
};
