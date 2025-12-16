"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchIncomingLeads = fetchIncomingLeads;
exports.fetchEventCalendar = fetchEventCalendar;
exports.fetchExpenses = fetchExpenses;
const dataContract_1 = require("../config/dataContract");
async function fetchIncomingLeads(client) {
    return client.listTasks({ listId: dataContract_1.CLICKUP.lists.incomingLeads });
}
async function fetchEventCalendar(client) {
    return client.listTasks({ listId: dataContract_1.CLICKUP.lists.eventCalendar });
}
async function fetchExpenses(client) {
    return client.listTasks({ listId: dataContract_1.CLICKUP.lists.expenses });
}
