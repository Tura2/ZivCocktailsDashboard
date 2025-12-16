import fs from 'node:fs';
import path from 'node:path';
import type { ClickUpClient } from '../clickup/ClickUpClient';
import type { ClickUpTask } from '../clickup/types';
import type { InstagramClient } from '../instagram/InstagramClient';

function fixtureTasks(fileName: string): ClickUpTask[] {
  const p = path.resolve(process.cwd(), 'backend', 'fixtures', fileName);
  const raw = fs.readFileSync(p, 'utf8');
  const json = JSON.parse(raw) as { tasks: ClickUpTask[] };
  return json.tasks;
}

export class MockClickUpClient implements ClickUpClient {
  private readonly tasksByListId: Record<string, ClickUpTask[]>;

  constructor(tasksByListId: Record<string, ClickUpTask[]>) {
    this.tasksByListId = tasksByListId;
  }

  async listTasks(options: { listId: string }): Promise<ClickUpTask[]> {
    return this.tasksByListId[options.listId] ?? [];
  }
}

export class MockInstagramClient implements InstagramClient {
  async getFollowerCountSeries(): Promise<Array<{ endTimeIso: string; value: number }>> {
    // Deterministic sample set for local tests.
    return [
      { endTimeIso: '2025-11-30T23:59:59.000Z', value: 1000 },
      { endTimeIso: '2025-12-15T23:59:59.000Z', value: 1020 },
    ];
  }
}

export function createMockClickUpClient(): ClickUpClient {
  return new MockClickUpClient({
    '901214362127': fixtureTasks('clickup-incoming-leads.json'),
    '901214362128': fixtureTasks('clickup-event-calendar.json'),
    '901214544874': fixtureTasks('clickup-expenses.json'),
  });
}

export function createMockInstagramClient(): InstagramClient {
  return new MockInstagramClient();
}

export function mockComputedAt(): Date {
  return new Date('2025-12-16T12:00:00.000Z');
}
