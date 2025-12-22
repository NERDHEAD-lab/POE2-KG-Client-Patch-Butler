import EventEmitter from 'events';

type LogType = 'info' | 'warn' | 'error' | 'success';

interface LogEvent {
    message: string;
    type: LogType;
    duration?: number;
}

class Logger extends EventEmitter {
    log(message: string, type: LogType = 'info', duration: number = 3000) {
        this.emit('log', { message, type, duration });
    }

    info(message: string, duration?: number) {
        this.log(message, 'info', duration);
    }

    warn(message: string, duration?: number) {
        this.log(message, 'warn', duration);
    }

    error(message: string, duration?: number) {
        this.log(message, 'error', duration);
    }

    success(message: string, duration?: number) {
        this.log(message, 'success', duration);
    }
}

export const logger = new Logger();
