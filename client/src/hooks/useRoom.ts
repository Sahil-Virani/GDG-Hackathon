import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrivateView, RoomView } from '../../../shared/schema';
import { api } from '../lib/api';
import { useSession } from '../stores/session';
export function useRoom(code: string) {
  const credentials = useSession((s) => s.credentials);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [mine, setMine] = useState<PrivateView | null>(null);
  const [error, setError] = useState('');
  const active = useRef(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const data = await api<{ room: RoomView; mine: PrivateView }>(`/rooms/${code}/state`);
      if (active.current && seq === sequence.current) {
        setRoom((previous) =>
          previous && previous.revision > data.room.revision ? previous : data.room,
        );
        setMine(data.mine);
        setError('');
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    }
  }, [code]);
  useEffect(() => {
    active.current = true;
    if (!credentials || credentials.roomCode !== code) return;
    void refresh();
    const poll = setInterval(() => void refresh(), 1500);
    const heartbeat = () => void api(`/rooms/${code}/heartbeat`, {}).catch(() => {});
    void api(`/rooms/${code}/connection`, { connected: true }).catch(() => {});
    heartbeat();
    const beat = setInterval(heartbeat, 10_000);
    const online = () => {
      heartbeat();
      void refresh();
    };
    window.addEventListener('online', online);
    return () => {
      active.current = false;
      clearInterval(poll);
      clearInterval(beat);
      window.removeEventListener('online', online);
    };
  }, [code, credentials, refresh]);
  return { room, mine, refresh, error };
}
