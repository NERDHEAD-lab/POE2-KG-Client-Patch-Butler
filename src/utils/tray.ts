import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import EventEmitter from 'events';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { TRAY_APP_BASE64 } from '../generated/trayAppBase64.js';
import { logger } from './logger.js';

// --- Utils ---
const attr = (name: string, val: any): string => {
    if (val === undefined) return '';
    if (typeof val == "boolean") val = val ? "true" : "false";
    return `${name}="${escapeXML(val)}"`;
};

function attrs(dict: any, keys?: string[]) {
    let body = [];
    for (let attrName of keys || Object.keys(dict))
        body.push(attr(attrName, dict[attrName]));
    return body.join(' ');
}

function escapeXML(str: any) {
    str = String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;');
    return str;
}

function defer() {
    let thisresolve: (value?: unknown) => void;
    let thisreject: (reason?: any) => void;

    const defer: any = new Promise((resolve, reject) => {
        thisresolve = resolve;
        thisreject = reject;
    });

    defer.resolve = (body: any) => { thisresolve(body); };
    defer.reject = (err: any) => { thisreject(err); };
    return defer;
}

function uuid() {
    return crypto.randomBytes(16).toString("hex");
}

function md5(str: string) {
    return crypto.createHash("md5").update(str).digest("hex");
}

// --- Tray Constants ---
const XML_HEAD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
const ITEM_TYPE_SEPARATOR = 'separator';

// --- Item Class ---
const ITEM_OPTIONS = ["disabled", "checked", "bold", "type"];

class Item {
    uid: string;
    action: () => void;
    label: string;
    items: Item[];
    [key: string]: any;

    constructor(label: any, props: any = {}) {
        if (typeof label == "object")
            (props = label), (label = "-");
        if (typeof props == "function")
            props = { action: props };

        this.uid = uuid();
        this.action = props.action || (() => { });
        this.label = label;
        this.items = [];

        for (let opt of ITEM_OPTIONS)
            this[opt] = props[opt];
    }

    add(...items: Item[]) {
        this.items.push(...items);
    }

    asXML() {
        let args = ["label", "uid", ...ITEM_OPTIONS];
        let body = `<item ${attrs(this, args)}`;

        if (this.items.length) {
            body += `>\n`;
            for (const item of this.items)
                body += item.asXML() + `\n`;
            body += `</item>`;
        } else { body += `/>`; }

        return body;
    }
}

// --- Tray Class ---
export interface TrayOptions {
    title?: string;
    icon?: Buffer;
    debug?: boolean;
    action?: Function;
    useTempDir?: boolean | "clean";
    trayAppPath?: string;
}

export class Tray extends EventEmitter {
    cbs: { [key: string]: any };
    uid: string;
    title: string;
    icon: Buffer | undefined;
    debug: boolean | undefined;
    client: net.Socket | null;
    connected: Promise<any>;
    _useTempDir: boolean | "clean" | undefined;
    trayAppPath: string | undefined;

    constructor(opts: TrayOptions = {}) {
        super();
        this.cbs = {};
        this.uid = uuid();
        this.title = opts.title || "Hi";
        this.icon = opts.icon;
        this.debug = opts.debug;
        this.setAction(opts.action || Function.prototype);
        this.client = null;
        this.connected = new Promise(resolve => this.on("connected", resolve));
        this._useTempDir = opts.useTempDir;
        this.trayAppPath = opts.trayAppPath;
    }

    static async create(opts: TrayOptions | ((...args: any[]) => void), ready?: (...args: any[]) => void) {
        if (typeof opts == "function")
            (ready = opts), (opts = {});

        const options = opts as TrayOptions;
        let tray = new Tray(options);

        // --- Custom Binary Logic Injected Here ---
        if (tray.trayAppPath && fs.existsSync(tray.trayAppPath)) {
            // If path provided and exists, use it
        } else if (tray._useTempDir) {
            await new Promise<void>((resolve, reject) => {
                let executableName = path.basename(process.execPath, '.exe');
                let computedId = md5(executableName + (options.title || 'Tray'));
                let filename = `${executableName}-trayicon-${computedId}.exe`;
                let tmppath = path.join(os.tmpdir(), filename);

                tray.trayAppPath = tmppath;

                if (fs.existsSync(tmppath)) {
                    resolve();
                } else {
                    // Write the Base64 binary to temp
                    try {
                        fs.writeFileSync(tmppath, Buffer.from(TRAY_APP_BASE64, 'base64'));
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        }

        tray._connect();

        if (ready)
            tray.on('connected', ready);
        return await tray.connected;
    }

    async _connect() {
        let port = 0;
        if (this.debug) port = 5678;

        let defered = defer();
        let server = net.createServer(defered.resolve);

        port = await new Promise((resolve) =>
            server.listen(port, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
        );

        if (!this.debug && this.trayAppPath) {
            let child = spawn(this.trayAppPath, [port.toString()]);
            child.on('exit', (code) => {
                if (code !== 0) {
                    this.emit('error', `Invalid exit code ${code}`);
                }
                if (this.client) this.client.end();
                if (this._useTempDir === "clean" && this.trayAppPath)
                    try { fs.unlinkSync(this.trayAppPath); } catch { }
                server.close();
            });
        }

        this.client = await defered;
        if (this.client) {
            this.client.on('error', () => { server.close(); });
            this.client.on("data", this._dispatch.bind(this));
        }
        this.emit("connected", this);
        this._draw();
    }

    register(cid: string, target: any) {
        this.cbs[cid] = target;
    }

    setTitle(title: string) {
        this.title = title;
        this._draw();
    }

    setAction(action: Function) {
        if (action)
            this.register(this.uid, { action });
    }

    _draw() {
        if (!this.client) return;
        let payload = this.asXML();
        this.client.write(payload);
        this.client.write(Buffer.from([0]));
    }

    setMenu(...items: Item[]) {
        if (!this.client) {
            logger.warn('트레이: 클라이언트가 연결되지 않았습니다. 메뉴 설정을 건너뜁니다.');
            return;
        }
        let payload = XML_HEAD;
        payload += `<menu>\n`;
        for (let item of items)
            payload += item.asXML() + `\n`;
        payload += `</menu>`;
        this.client.write(payload);
        this.client.write(Buffer.from([0]));
    }

    asXML() {
        let payload = XML_HEAD;
        payload += `<tray ${attrs(this, ['title', 'uid'])}>\n`;
        if (this.icon)
            payload += `<icon>${this.icon.toString('base64')}</icon>\n`;
        payload += `</tray>`;
        return payload;
    }

    _dispatch(msg: Buffer) {
        let cid = msg.toString();
        let target = this.cbs[cid];
        if (target && target.action)
            target.action();
    }

    item(label: string | object, props?: any) {
        let item = new Item(label, props);
        this.cbs[item.uid] = item;
        return item;
    }
}

export default Tray;
