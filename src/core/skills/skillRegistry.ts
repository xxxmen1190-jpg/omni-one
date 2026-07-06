export const skillRegistry: Record<string, { name: string; enabled: boolean }> = {
  webSearch: { name: "Web Search", enabled: false },
  codeGen: { name: "Code Generation", enabled: false },
  summarizer: { name: "Summarizer", enabled: false },
  imageGen: { name: "Image Generation", enabled: false },
};

export function getSkill(name: string) {
  return skillRegistry[name] ?? null;
}
