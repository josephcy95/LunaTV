'use client';

import dynamic from 'next/dynamic';

import { useDownload } from '@/contexts/DownloadContext';

const DownloadPanel = dynamic(
  () =>
    import('./DownloadPanel').then((mod) => ({ default: mod.DownloadPanel })),
  { ssr: false, loading: () => null },
);

/** Mount download UI only after the panel is opened. The provider stays in layout. */
export default function DownloadPanelGate() {
  const { showDownloadPanel } = useDownload();
  return showDownloadPanel ? <DownloadPanel /> : null;
}
