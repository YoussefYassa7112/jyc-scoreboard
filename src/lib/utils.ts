export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Light fills (yellow, cream) need dark ink; dark fills need cream text. */
export function needsDarkText(hex: string) {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return false;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

export function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return `rgba(107, 66, 38, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return `rgba(107, 66, 38, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function teamChipStyle(color: string, active: boolean) {
  const darkText = needsDarkText(color);
  const ink = darkText ? "#1a140e" : "#fff8ee";
  const border = darkText ? "#5c4033" : color;
  if (active) {
    return {
      backgroundColor: color,
      borderColor: border,
      color: ink,
    };
  }
  return {
    backgroundColor: hexToRgba(color, darkText ? 0.5 : 0.28),
    borderColor: border,
    color: darkText ? "#1a140e" : color,
  };
}

