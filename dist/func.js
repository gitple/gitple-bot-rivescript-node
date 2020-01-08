"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger = require("winston");
// tslint:disable-next-line:variable-name
function funcInitialize(RiveScriptBot) {
    // bot start message
    RiveScriptBot._rs.setSubroutine('startMsg', function (rs, args) {
        return new rs.Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const self = this;
            try {
                const msg = 'Welcome. Gitple.\n';
                resolve(msg);
            }
            catch (error) {
                logger.error('Error startMsg: ', error);
                let msg = 'I\'m sorry. Please say that again.';
                self.sendMessage(msg, () => {
                    self.sendCommand('botEnd');
                });
            }
        }));
    });
}
exports.funcInitialize = funcInitialize;
