'use client';

import dynamic from 'next/dynamic';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

const ChatFloatingWindow = dynamic(() => import('./ChatFloatingWindow'), {
  ssr: false,
  loading: () => null,
});

/** Mount the expensive chat/voice UI only after a watch room exists. */
export default function ChatFloatingWindowGate() {
  const watchRoom = useWatchRoomContextSafe();
  return watchRoom?.currentRoom ? <ChatFloatingWindow /> : null;
}
