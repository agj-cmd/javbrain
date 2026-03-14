"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
/**
 * Singleton for the extension context.
 */
class Context {
    /** The current context. */
    static get current() { return this._current; }
    /**
     * Sets the context.
     * @param context The context to set.
     */
    static set(context) {
        this._current = context;
    }
}
exports.Context = Context;
//# sourceMappingURL=context.js.map