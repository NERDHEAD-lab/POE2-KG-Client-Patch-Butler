import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { getLogsDirectory } from './config.js';

// --- Logger Constants ---
const LOG_RETENTION_DAYS = 31;
const MAX_LOG_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss'; // Implementation detail in code

type LogType = 'info' | 'warn' | 'error' | 'success';

interface LogEvent {
    message: string;
    type: LogType;
}

export class Logger extends EventEmitter {
    private logDir: string;
    private suffix: string;

    constructor(suffix: string = 'application') {
        super();
        this.suffix = suffix;
        this.logDir = getLogsDirectory();
        this.rotateLogs();
    }

    public setSuffix(suffix: string) {
        this.suffix = suffix;
        this.rotateLogs(); // Rotate logs for the new suffix to ensure cleanup
    }


    private getLogFileName(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}-${this.suffix}.log`;
    }

    private rotateLogs() {
        try {
            if (!fs.existsSync(this.logDir)) return;

            // Filter files that match the current suffix pattern
            // YYYY-MM-DD-application.log or YYYY-MM-DD-watcher.log
            const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${this.suffix}\\.log$`);

            const files = fs.readdirSync(this.logDir)
                .filter(file => file.match(pattern))
                .sort(); // Alphabetical sort works for YYYY-MM-DD

            if (files.length > LOG_RETENTION_DAYS) {
                const logsToDelete = files.slice(0, files.length - LOG_RETENTION_DAYS);
                logsToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(this.logDir, file));
                    } catch (e) {
                        console.error('Failed to delete old log file:', file, e);
                    }
                });
            }
        } catch (e) {
            console.error('Failed to rotate logs:', e);
        }
    }

    private checkFileSize(filePath: string) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size >= MAX_LOG_FILE_SIZE) {
                    const parsed = path.parse(filePath);
                    const backupPath = path.join(parsed.dir, `${parsed.name}_${Date.now()}${parsed.ext}`);
                    fs.renameSync(filePath, backupPath);
                }
            }
        } catch (e) {
            console.error('Failed to rotate large log file:', e);
        }
    }

    private writeToFile(message: string, type: LogType) {
        try {
            const logFile = path.join(this.logDir, this.getLogFileName());

            // Check size before writing
            this.checkFileSize(logFile);

            const now = new Date();
            // Format: [YYYY-MM-DD HH:mm:ss]
            const iso = now.toISOString(); // 2023-12-23T09:00:00.000Z
            const datePart = iso.split('T')[0];
            const timePart = iso.split('T')[1].split('.')[0];
            const timestampStr = `${datePart} ${timePart}`;

            const logLine = `[${timestampStr}] [${type.toUpperCase()}] ${message}\n`;

            fs.appendFileSync(logFile, logLine, 'utf8');
        } catch (e) {
            console.error('Failed to write to log file:', e);
        }
    }

    log(message: string, type: LogType = 'info') {
        // Emit for UI
        this.emit('log', { message, type });

        // Write to file
        this.writeToFile(message, type);
    }

    info(message: string) {
        this.log(message, 'info');
    }

    warn(message: string) {
        this.log(message, 'warn');
    }

    error(message: string) {
        this.log(message, 'error');
    }

    success(message: string) {
        this.log(message, 'success');
    }
}

export const logger = new Logger();
