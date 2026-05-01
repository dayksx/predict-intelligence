"use client";

import { useEffect, useState } from "react";

/** True after mount — avoids SSR vs client mismatches for wallet / browser-only UI. */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
