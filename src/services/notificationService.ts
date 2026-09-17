export interface InAppNotification {
  title: string;
  message: string;
  module: string;
  timestamp: Date;
}

class NotificationService {
  private listeners: ((notification: InAppNotification) => void)[] = [];

  subscribe(listener: (notification: InAppNotification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  showAppAlert(title: string, message: string, module = 'GENERAL') {
    const item: InAppNotification = {
      title,
      message,
      module,
      timestamp: new Date(),
    };
    this.listeners.forEach((l) => l(item));
  }
}

export const notificationService = new NotificationService();
