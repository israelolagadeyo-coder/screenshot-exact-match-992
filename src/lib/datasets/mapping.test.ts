import { describe, expect, it } from "vitest";
import { detectDatasetType, getMappedFields, getUnmappedColumns, suggestMapping } from "./mapping";
import type { DetectedColumn } from "./types";

function cols(list: [string, DetectedColumn["type"]][]): DetectedColumn[] {
  return list.map(([name, type]) => ({ name, type, sample: null, missing: 0, unique: 2, values: [] }));
}

const sales = cols([
  ["Order Date", "date"],
  ["Item Name", "text"],
  ["Client", "text"],
  ["Qty", "number"],
  ["Price", "number"],
  ["Total", "number"],
]);

describe("dataset column mapping", () => {
  it("detects sales files", () => {
    expect(detectDatasetType(sales)).toBe("sales");
  });

  it("maps standard field keys to source columns (direction used by analytics SQL)", () => {
    expect(suggestMapping(sales, "sales")).toEqual({
      date: "Order Date",
      product: "Item Name",
      customer: "Client",
      quantity: "Qty",
      unit_price: "Price",
      revenue: "Total",
    });
  });

  it("never reuses one source column for two fields", () => {
    const mapping = suggestMapping(sales, "sales");
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });

  it("reports unmapped and mapped columns consistently", () => {
    const withExtra = [...sales, ...cols([["Sales Rep", "text"]])];
    const mapping = suggestMapping(withExtra, "sales");
    expect(getUnmappedColumns(withExtra, mapping).map((c) => c.name)).toEqual(["Sales Rep"]);
    expect(getMappedFields(mapping, "sales").find((m) => m.field.key === "revenue")?.sourceColumn).toBe(
      "Total",
    );
  });

  it("detects expenses and customers files", () => {
    const expenses = cols([
      ["Paid On", "date"],
      ["Expense Type", "text"],
      ["Cost", "number"],
    ]);
    expect(detectDatasetType(expenses)).toBe("expenses");
    expect(suggestMapping(expenses, "expenses").amount).toBe("Cost");

    const customers = cols([
      ["Cust ID", "text"],
      ["Full Name", "text"],
      ["Total Spent", "number"],
    ]);
    expect(detectDatasetType(customers)).toBe("customers");
    expect(suggestMapping(customers, "customers").purchase).toBe("Total Spent");
  });
});
