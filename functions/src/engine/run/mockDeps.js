"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockInstagramClient = exports.MockClickUpClient = void 0;
exports.createMockClickUpClient = createMockClickUpClient;
exports.createMockInstagramClient = createMockInstagramClient;
exports.mockComputedAt = mockComputedAt;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function fixtureTasks(fileName) {
    const p = node_path_1.default.resolve(process.cwd(), 'backend', 'fixtures', fileName);
    const raw = node_fs_1.default.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    return json.tasks;
}
class MockClickUpClient {
    tasksByListId;
    constructor(tasksByListId) {
        this.tasksByListId = tasksByListId;
    }
    async listTasks(options) {
        return this.tasksByListId[options.listId] ?? [];
    }
}
exports.MockClickUpClient = MockClickUpClient;
class MockInstagramClient {
    async getFollowerCountSeries() {
        // Deterministic sample set for local tests.
        return [
            { endTimeIso: '2025-11-30T23:59:59.000Z', value: 1000 },
            { endTimeIso: '2025-12-15T23:59:59.000Z', value: 1020 },
        ];
    }
}
exports.MockInstagramClient = MockInstagramClient;
function createMockClickUpClient() {
    return new MockClickUpClient({
        '901214362127': fixtureTasks('clickup-incoming-leads.json'),
        '901214362128': fixtureTasks('clickup-event-calendar.json'),
        '901214544874': fixtureTasks('clickup-expenses.json'),
    });
}
function createMockInstagramClient() {
    return new MockInstagramClient();
}
function mockComputedAt() {
    return new Date('2025-12-16T12:00:00.000Z');
}
