import { CLICKUP } from '../config/dataContract';
import type { ClickUpClient } from './ClickUpClient';
import type { ClickUpTask } from './types';

export async function fetchIncomingLeads(client: ClickUpClient): Promise<ClickUpTask[]> {
  return client.listTasks({ listId: CLICKUP.lists.incomingLeads });
}

export async function fetchEventCalendar(client: ClickUpClient): Promise<ClickUpTask[]> {
  return client.listTasks({ listId: CLICKUP.lists.eventCalendar });
}

export async function fetchExpenses(client: ClickUpClient): Promise<ClickUpTask[]> {
  return client.listTasks({ listId: CLICKUP.lists.expenses });
}
