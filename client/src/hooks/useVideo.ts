import { useCallback, useEffect, useRef, useState } from 'react';
import type * as OT from '@opentok/client';
import { eventSchema, reactionSchema, type VideoCredentials } from '../../../shared/schema';
import { api } from '../lib/api';
import { requestMedia } from '../lib/media';
export function useVideo(code: string, name: string, onUpdate: () => Promise<void>) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<string, OT.Stream>>({});
  const [session, setSession] = useState<OT.Session | null>(null);
  const [connection, setConnection] = useState('Connecting');
  const [error, setError] = useState('');
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [retryIndex, setRetryIndex] = useState(0);
  const [reactions, setReactions] = useState<{ id: string; targetId: string; emoji: string }[]>([]);
  const publisher = useRef<OT.Publisher | null>(null);
  const signalTime = useRef(0);
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  const addReaction = useCallback((targetId: string, emoji: string) => {
    const id = crypto.randomUUID();
    setReactions((r) => [...r.slice(-12), { id, targetId, emoji }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2000);
  }, []);
  useEffect(() => {
    let alive = true;
    let media: MediaStream | undefined;
    let videoSession: OT.Session | undefined;
    let pub: OT.Publisher | undefined;
    let holder: HTMLDivElement | undefined;
    setError('');
    setConnection('Connecting');
    setRemote({});
    const report = (connected: boolean, extra: Record<string, unknown> = {}) =>
      void api(`/rooms/${code}/connection`, { connected, ...extra })
        .then(() => updateRef.current())
        .catch(() => {});
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Camera access needs HTTPS or localhost. You can still join and upload a fit photo.',
          );
        try {
          media = await requestMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: true,
          });
        } catch {
          try {
            media = await requestMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
            if (alive)
              setError(
                'Microphone unavailable. You can continue with video and retry permissions later.',
              );
          } catch {
            if (alive)
              setError(
                'Camera permission denied or camera unavailable. Allow access and retry, or upload a fit photo.',
              );
          }
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (!alive) {
        media?.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(media ?? null);
      setCamera(!!media?.getVideoTracks().length);
      setMic(!!media?.getAudioTracks().length);
      report(true, {
        camera: !!media?.getVideoTracks().length,
        mic: !!media?.getAudioTracks().length,
      });
      try {
        const { video } = await api<{ video: VideoCredentials | null }>(`/rooms/${code}/video`, {});
        if (!alive) return;
        if (!video) {
          setConnection('Local camera · demo');
          return;
        }
        const OT = await import('@opentok/client');
        if (!alive) return;
        videoSession = OT.initSession(video.applicationId, video.sessionId);
        setSession(videoSession);
        videoSession.on('streamCreated', (event) => {
          if (!alive) return;
          try {
            const data = JSON.parse(event.stream.connection.data);
            if (typeof data.participantId === 'string')
              setRemote((v) => ({ ...v, [data.participantId]: event.stream }));
          } catch {
            /* Ignore non-game publisher metadata. */
          }
        });
        videoSession.on('streamDestroyed', (event) => {
          if (!alive) return;
          setRemote((v) =>
            Object.fromEntries(
              Object.entries(v).filter(([, s]) => s.streamId !== event.stream.streamId),
            ),
          );
        });
        videoSession.on('connectionCreated', () => {
          void updateRef.current();
        });
        videoSession.on('connectionDestroyed', () => {
          void updateRef.current();
        });
        videoSession.on('sessionReconnecting', () => {
          if (alive) {
            setConnection('Reconnecting…');
            report(false);
          }
        });
        videoSession.on('sessionReconnected', () => {
          if (alive) {
            setConnection('Live on Vonage');
            report(true, { connectionId: videoSession?.connection?.connectionId });
          }
        });
        videoSession.on('sessionDisconnected', () => {
          if (alive) {
            setConnection('Disconnected');
            setError('Video disconnected. Retry to rejoin the call.');
            report(false);
          }
        });
        videoSession.on('signal', (event) => {
          if (!alive || !event.data) return;
          try {
            const payload = JSON.parse(event.data);
            if (String(event.type) === 'signal:battle' && eventSchema.safeParse(payload).success) {
              void updateRef.current();
            }
            if (String(event.type) === 'signal:reaction') {
              const parsed = reactionSchema.safeParse(payload);
              if (parsed.success) addReaction(parsed.data.targetId, parsed.data.emoji);
            }
          } catch {
            /* Signals are hints, never trusted game state. */
          }
        });
        await videoSession.connect.promise(video.token);
        if (!alive) {
          void videoSession.disconnect();
          return;
        }
        setConnection('Live on Vonage');
        report(true, { connectionId: videoSession.connection?.connectionId });
        if (media) {
          holder = document.createElement('div');
          holder.className = 'publisher-source';
          document.body.appendChild(holder);
          pub = OT.initPublisher(
            holder,
            {
              videoSource: media.getVideoTracks()[0] ?? false,
              audioSource: media.getAudioTracks()[0] ?? false,
              name,
              insertMode: 'append',
              width: 160,
              height: 90,
              showControls: false,
            },
            (err) => {
              if (err && alive) setError('Publishing failed. Retry the camera connection.');
            },
          );
          publisher.current = pub;
          await videoSession.publish.promise(pub);
        }
      } catch {
        if (alive) {
          setConnection('Video unavailable');
          setError(
            'Could not join Vonage video. Check server credentials or retry. The game room is still available.',
          );
        }
      }
    })();
    return () => {
      alive = false;
      publisher.current = null;
      pub?.destroy();
      videoSession?.off();
      void videoSession?.disconnect();
      holder?.remove();
      media?.getTracks().forEach((t) => t.stop());
      setSession(null);
    };
  }, [code, name, retryIndex, addReaction]);
  function toggleMic() {
    const value = !mic;
    if (!stream?.getAudioTracks().length) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = value));
    publisher.current?.publishAudio(value);
    setMic(value);
    void api(`/rooms/${code}/connection`, { connected: true, mic: value }).catch(() => {});
  }
  function toggleCamera() {
    const value = !camera;
    if (!stream?.getVideoTracks().length) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = value));
    publisher.current?.publishVideo(value);
    setCamera(value);
    void api(`/rooms/${code}/connection`, { connected: true, camera: value }).catch(() => {});
  }
  function react(targetId: string, emoji: string) {
    if (Date.now() - signalTime.current < 1100) return;
    signalTime.current = Date.now();
    const payload = reactionSchema.parse({ type: 'reaction', targetId, emoji });
    if (session)
      void session
        .signal({ type: 'reaction', data: JSON.stringify(payload), retryAfterReconnect: false })
        .catch(() => addReaction(targetId, emoji));
    else addReaction(targetId, emoji);
  }
  return {
    stream,
    remote,
    session,
    connection,
    error,
    mic,
    camera,
    toggleMic,
    toggleCamera,
    retry: () => setRetryIndex((i) => i + 1),
    react,
    reactions,
  };
}
