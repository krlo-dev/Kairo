import { create } from 'zustand';

export type Plan = 'FREE' | 'PRO' | 'COMERCIANTE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  emailVerified: boolean;
  whatsappVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({ user: null, isLoading: false }),
}));
