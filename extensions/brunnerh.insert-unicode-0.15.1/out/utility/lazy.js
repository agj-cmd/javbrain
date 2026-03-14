"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lazy = void 0;
/**
 * Creates a lazy value.
 * @param factory Value factory.
 * @returns Lazy value.
 */
function lazy(factory) {
    let resolved = false;
    let value;
    return () => {
        if (resolved === false) {
            value = factory();
            resolved = true;
        }
        return value;
    };
}
exports.lazy = lazy;
//# sourceMappingURL=lazy.js.map