import { useEffect, useState } from 'react';
import { createBrowserSource, type BrowserSource } from './browserSource';

// one source for as long as the panel is open
export function useBrowserSource(): BrowserSource | undefined {
  const [source, setSource] = useState<BrowserSource>();

  useEffect(() => {
    const created = createBrowserSource();
    setSource(created);
    return () => created.dispose();
  }, []);

  return source;
}
