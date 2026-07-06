export const memoryStore = {
  save: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  load: (key: string) => {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  }
};
