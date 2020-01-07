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
    // 봇 시작 안내 문구
    RiveScriptBot._rs.setSubroutine('startMsg', function (rs, args) {
        return new rs.Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const self = this;
            try {
                const msg = '환영합니다.';
                self.sendMessage(msg, () => {
                    resolve(true);
                });
            }
            catch (error) {
                logger.error('Error startMsg: ', error);
                let msg = '서비스에 문제가 발생하였습니다.\n종료합니다.';
                self.sendMessage(msg, () => {
                    self.sendCommand('botEnd');
                });
            }
        }));
    });
}
exports.funcInitialize = funcInitialize;
