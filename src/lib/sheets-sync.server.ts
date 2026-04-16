const SHEET_ID = "1l11G6LEt2JJKEROrN64DWI7xHEzAsnk8jrheWlcfLA8";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      row.push(current.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

export interface SheetUser {
  name: string;
  surname: string;
  username: string;
  password: string;
  accountType: string;
}

export async function fetchSheetUsers(): Promise<SheetUser[]> {
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error("Failed to fetch Google Sheet");
  const csv = await response.text();
  const rows = parseCSV(csv);

  const headerIdx = rows.findIndex(
    (r) =>
      r[0]?.toLowerCase().includes("name") &&
      r[1]?.toLowerCase().includes("surname"),
  );
  if (headerIdx === -1) return [];

  return rows
    .slice(headerIdx + 1)
    .filter((r) => r.length >= 5 && r[2])
    .map((r) => ({
      name: r[0],
      surname: r[1],
      username: r[2],
      password: r[3],
      accountType: r[4],
    }));
}
