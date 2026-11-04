export function warningText(warning, translate) {
  if (typeof warning === "string") return translate(warning);
  if (!warning || typeof warning !== "object" || typeof warning.key !== "string") return "";
  let text = translate(warning.key);
  if (warning.count !== undefined) text = text.replace("{count}", String(warning.count));
  return text;
}
