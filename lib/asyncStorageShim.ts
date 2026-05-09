const memoryStore = new Map<string, string>();

const getStorage = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const asyncStorage = {
  getItem: async (key: string) => {
    const storage = getStorage();
    if (storage) {
      return storage.getItem(key);
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: async (key: string, value: string) => {
    const storage = getStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }
    memoryStore.set(key, value);
  },
  removeItem: async (key: string) => {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(key);
      return;
    }
    memoryStore.delete(key);
  },
  clear: async () => {
    const storage = getStorage();
    if (storage) {
      storage.clear();
      return;
    }
    memoryStore.clear();
  },
};

export default asyncStorage;
export { asyncStorage as AsyncStorage };
