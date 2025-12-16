"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickUpHttpClient = void 0;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getHeaderInt(headers, name) {
    const v = headers.get(name);
    if (!v)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function toUrl(base, params) {
    const url = new URL(base);
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined)
            continue;
        url.searchParams.set(k, String(v));
    }
    return url.toString();
}
class ClickUpHttpClient {
    apiToken;
    baseUrl;
    maxRetries;
    constructor(options) {
        this.apiToken = options.apiToken;
        this.baseUrl = options.baseUrl ?? 'https://api.clickup.com/api/v2';
        this.maxRetries = options.maxRetries ?? 6;
    }
    async listTasks(options) {
        const pageSize = options.pageSize ?? 100;
        const includeClosed = options.includeClosed ?? true;
        const tasks = [];
        // ClickUp pagination is 0-based page
        for (let page = 0; page < 200; page += 1) {
            const url = toUrl(`${this.baseUrl}/list/${options.listId}/task`, {
                page,
                limit: pageSize,
                include_closed: includeClosed,
                archived: false,
            });
            const json = await this.requestJson(url);
            tasks.push(...(json.tasks ?? []));
            const got = json.tasks?.length ?? 0;
            if (json.last_page === true)
                break;
            if (got < pageSize)
                break;
        }
        return tasks;
    }
    async requestJson(url) {
        let attempt = 0;
        while (true) {
            attempt += 1;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: this.apiToken,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                return (await res.json());
            }
            // Handle rate limits / transient failures
            if ((res.status === 429 || res.status >= 500) && attempt <= this.maxRetries) {
                const retryAfterSeconds = getHeaderInt(res.headers, 'Retry-After');
                const baseDelay = retryAfterSeconds != null ? retryAfterSeconds * 1000 : 250 * Math.pow(2, attempt - 1);
                const jitter = Math.floor(Math.random() * 200);
                await sleep(baseDelay + jitter);
                continue;
            }
            const body = await res.text().catch(() => '');
            throw new Error(`ClickUp request failed (${res.status}) ${res.statusText} for ${url}. ${body}`);
        }
    }
}
exports.ClickUpHttpClient = ClickUpHttpClient;
