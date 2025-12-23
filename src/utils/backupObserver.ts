type Listener = () => void;

const listeners: Listener[] = [];

export const subscribeToBackupCreated = (callback: Listener): (() => void) => {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
};

export const notifyBackupCreated = () => {
    listeners.forEach(listener => listener());
};
