import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * useState แต่ sync กับ localStorage อัตโนมัติ
 * reload หน้าก็ยังได้ค่าเดิม
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  // Sync to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage quota exceeded or private mode — ignore
    }
  }, [key, value]);

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (action) => setValueRaw(action),
    []
  );

  return [value, setValue];
}
