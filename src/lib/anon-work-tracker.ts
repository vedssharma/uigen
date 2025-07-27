const STORAGE_KEY = "uigen_has_anon_work";
const DATA_KEY = "uigen_anon_data";
const MIN_MESSAGES_THRESHOLD = 0;
const MIN_FILES_THRESHOLD = 1; // > 1 because root "/" always exists

export function setHasAnonWork(messages: unknown[], fileSystemData: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  
  const hasContent = messages.length > MIN_MESSAGES_THRESHOLD || 
                    Object.keys(fileSystemData).length > MIN_FILES_THRESHOLD;
  
  if (hasContent) {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
      sessionStorage.setItem(DATA_KEY, JSON.stringify({ messages, fileSystemData }));
    } catch (error) {
      console.warn('Failed to save anonymous work data:', error);
    }
  }
}

export function getHasAnonWork(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

export function getAnonWorkData(): { messages: unknown[], fileSystemData: Record<string, unknown> } | null {
  if (typeof window === "undefined") return null;
  
  const data = sessionStorage.getItem(DATA_KEY);
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Failed to parse anonymous work data:', error);
    return null;
  }
}

export function clearAnonWork(): void {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(DATA_KEY);
  } catch (error) {
    console.warn('Failed to clear anonymous work data:', error);
  }
}