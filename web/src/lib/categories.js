// Each cause gets its own ink colour and a simple motif used for generated covers.
export const CATEGORIES = [
  { name: "Education", ink: "#2C3E91", wash: "#DDE3F7", motif: "rows" },
  { name: "Health", ink: "#B3352B", wash: "#F6DEDA", motif: "plus" },
  { name: "Environment", ink: "#2D6B4F", wash: "#D9EDE2", motif: "leaf" },
  { name: "Disaster Relief", ink: "#9A5B12", wash: "#F5E5CC", motif: "wave" },
  { name: "Animal Welfare", ink: "#6B4A8C", wash: "#E7DDF1", motif: "dots" },
  { name: "Women & Children", ink: "#A8356A", wash: "#F5DCE8", motif: "rings" },
  { name: "Community", ink: "#1F6F7A", wash: "#D6ECEE", motif: "grid" },
  { name: "Other", ink: "#4A4F5C", wash: "#E3E5EA", motif: "dots" },
];

export function category(name) {
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}
