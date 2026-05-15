import { create } from 'zustand';

export type UploadStep = 'drop' | 'decoding' | 'reveal';

export interface Collaborator {
    id: string;
    name: string;
    percentage: number;
}

interface UploadStore {
    step: UploadStep;
    file: File | null;
    analysisProgress: number; // 0 to 100
    hitScore: number;
    
    // Section A: AI Suggested
    metadata: {
        genre: string;
        bpm: string;
        key: string;
        mood: string;
    };

    // Section B: Professional
    profMeta: {
        title: string;
        isrc: string;
        explicit: boolean;
    };

    // Section C: Collaboration
    collaborators: Collaborator[];
    
    setStep: (step: UploadStep) => void;
    setFile: (file: File | null) => void;
    setAnalysisProgress: (progress: number) => void;
    setHitScore: (score: number) => void;
    setMetadata: (data: Partial<UploadStore['metadata']>) => void;
    setProfMeta: (data: Partial<UploadStore['profMeta']>) => void;
    
    addCollaborator: () => void;
    updateCollaborator: (id: string, updates: Partial<Collaborator>) => void;
    removeCollaborator: (id: string) => void;
    
    reset: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
    step: 'drop',
    file: null,
    analysisProgress: 0,
    hitScore: 0,
    
    metadata: { genre: '', bpm: '', key: '', mood: '' },
    profMeta: { title: '', isrc: '', explicit: false },
    collaborators: [{ id: '1', name: '', percentage: 100 }],
    
    setStep: (step) => set({ step }),
    setFile: (file) => set({ file }),
    setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
    setHitScore: (score) => set({ hitScore: score }),
    
    setMetadata: (data) => set((state) => ({ metadata: { ...state.metadata, ...data } })),
    setProfMeta: (data) => set((state) => ({ profMeta: { ...state.profMeta, ...data } })),
    
    addCollaborator: () => set((state) => ({
        collaborators: [...state.collaborators, { id: Math.random().toString(36).substring(7), name: '', percentage: 0 }]
    })),
    updateCollaborator: (id, updates) => set((state) => ({
        collaborators: state.collaborators.map(c => c.id === id ? { ...c, ...updates } : c)
    })),
    removeCollaborator: (id) => set((state) => ({
        collaborators: state.collaborators.filter(c => c.id !== id)
    })),
    
    reset: () => set({ 
        step: 'drop', 
        file: null, 
        analysisProgress: 0, 
        hitScore: 0,
        metadata: { genre: '', bpm: '', key: '', mood: '' },
        profMeta: { title: '', isrc: '', explicit: false },
        collaborators: [{ id: '1', name: '', percentage: 100 }]
    })
}));
