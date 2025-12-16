"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramUnavailableError = void 0;
class InstagramUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InstagramUnavailableError';
    }
}
exports.InstagramUnavailableError = InstagramUnavailableError;
