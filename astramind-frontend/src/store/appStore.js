import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

const useAppStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      currentRepo: null,
      githubToken: null,
      githubUser: null,
      
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      
      setCurrentRepo: (repo) => set({ currentRepo: repo }),
      clearCurrentRepo: () => set({ currentRepo: null }),

      setGithubAuth: (token, user) => set({ githubToken: token, githubUser: user }),
      logoutGithub: () => {
        toast.success("Logged out successfully");
        set({ githubToken: null, githubUser: null, currentRepo: null });
      },
    }),
    {
      name: 'astramind-storage',
    }
  )
);

export default useAppStore;
