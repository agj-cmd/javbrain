"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insert = void 0;
const recently_used_list_1 = require("./recently-used-list");
/**
 * Insert a Unicode entry into an editor.
 * @param editor The editor to insert into.
 * @param entry The entry that is being inserted (meta data).
 * @param value The textual value to insert.
 */
function insert(editor, entry, value) {
    return __awaiter(this, void 0, void 0, function* () {
        recently_used_list_1.RecentlyUsed.addEntry(entry.name);
        yield editor.edit(builder => editor.selections.forEach(selection => selection.isEmpty ?
            builder.insert(selection.active, value) :
            builder.replace(selection, value)));
    });
}
exports.insert = insert;
//# sourceMappingURL=editor.js.map