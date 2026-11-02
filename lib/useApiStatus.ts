"use client";

import { useEffect, useState } from "react";

/** Чи налаштовано на сервері ключ Claude API (тоді доступна кнопка аналізу через API). */
export function useApiStatus(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : { api: false }))
      .then((d: { api?: boolean }) => setEnabled(!!d.api))
      .catch(() => setEnabled(false));
  }, []);
  return enabled;
}
