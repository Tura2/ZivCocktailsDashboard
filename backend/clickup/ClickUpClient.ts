import type { ClickUpTask } from './types';

export interface ListTasksOptions {
  listId: string;
  includeClosed?: boolean;
  pageSize?: number;
}

export interface ClickUpClient {
  listTasks(options: ListTasksOptions): Promise<ClickUpTask[]>;
}
