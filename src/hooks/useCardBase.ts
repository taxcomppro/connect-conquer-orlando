import { useCallback, useEffect, useState } from "react";
import { CARD_BASE_STORAGE_KEY } from "@/lib/connect";

/**
 * The origin written onto NFC cards. Defaults to the current origin but can be
 * pinned to the published domain so cards never carry a preview URL.
 */
export function useCardBase() {
  const [base, setBaseState] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(CARD_BASE_STORAGE_KEY);
    setBaseState(stored || window.location.origin);
  }, []);

  const setBase = useCallback((value: string) => {
    const clean = value.trim().replace(/\/+$/, "");
    window.localStorage.setItem(CARD_BASE_STORAGE_KEY, clean);
    setBaseState(clean);
  }, []);

  return { base, setBase };
}
