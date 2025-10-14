export function formatUiDate(input: string | number | Date | null | undefined): string {
  if (!input) return "N/A";
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}


