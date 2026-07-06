export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
