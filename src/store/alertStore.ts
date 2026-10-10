import { create } from 'zustand';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

interface AlertState {
  isVisible: boolean;
  config: AlertConfig | null;
  queue: AlertConfig[];
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  isVisible: false,
  config: null,
  queue: [],
  showAlert: (title, message, buttons, options) => {
    const newAlert = { title, message, buttons, options };
    const { isVisible, queue } = get();
    
    if (isVisible) {
      set({ queue: [...queue, newAlert] });
    } else {
      set({ isVisible: true, config: newAlert });
    }
  },
  hideAlert: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const nextAlert = queue[0];
      set({
        isVisible: true,
        config: nextAlert,
        queue: queue.slice(1),
      });
    } else {
      set({ isVisible: false });
      // Keep config around briefly for exit animation
      setTimeout(() => set({ config: null }), 300);
    }
  },
}));
