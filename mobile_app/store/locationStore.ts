import { create } from 'zustand';

interface LocationState {
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  selectedLocation: 'Indore, MP',
  setSelectedLocation: (loc: string) => set({ selectedLocation: loc }),
}));
