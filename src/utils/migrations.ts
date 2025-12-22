import semver from 'semver';
import fs from 'fs';
import path from 'path';
import { getLastMigratedVersion, setLastMigratedVersion } from './config.js';

interface Migration {
    version: string;
    description: string;
    run: () => Promise<void>;
}

const migrations: Migration[] = [
    {
        version: '1.1.0',
        description: 'Cleanup legacy configuration folder (poe2-patch-butler-nodejs)',
        run: async () => {
            const appData = process.env.APPDATA || process.env.USERPROFILE;
            if (!appData) {
                return;
            }

            const oldPath = path.join(appData, 'poe2-patch-butler-nodejs');
            if (!fs.existsSync(oldPath)) {
                return;
            }

            try {
                fs.rmSync(oldPath, { recursive: true, force: true });
            } catch (e) {
                console.error('Failed to remove legacy config folder:', e);
            }
        }
    }
];

import { getAppVersion } from './version.js';

export const runMigrations = async () => {
    const currentVersion = getAppVersion();
    const lastVersion = getLastMigratedVersion();

    const pendingMigrations = migrations.filter(m =>
        semver.gt(m.version, lastVersion) && semver.lte(m.version, currentVersion)
    ).sort((a, b) => semver.compare(a.version, b.version));

    if (pendingMigrations.length === 0) {
        return;
    }

    for (const migration of pendingMigrations) {
        try {
            await migration.run();
            setLastMigratedVersion(migration.version);
        } catch (e) {
            console.error(`Migration ${migration.version} failed:`, e);
            throw e;
        }
    }
};
