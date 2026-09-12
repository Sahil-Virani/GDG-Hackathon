import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Credentials } from '../../../shared/schema';
interface SessionState {
  credentials: Credentials | null;
  setCredentials: (value: Credentials | null) => void;
}
export const useSession = create<SessionState>()(
  persist((set) => ({ credentials: null, setCredentials: (credentials) => set({ credentials }) }), {
    name: 'who-mogs-who-session',
    storage: createJSONStorage(() => sessionStorage),
  }),
);
