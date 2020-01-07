import logger = require('winston');
import * as _ from 'lodash';

// tslint:disable-next-line:variable-name
export function funcInitialize(RiveScriptBot: any) {
  // 봇 시작 안내 문구
  RiveScriptBot._rs.setSubroutine('startMsg', function (rs: any, args: any) {
    return new rs.Promise(async (resolve: any, reject: any) => {
      const self = this;
      try {
        const msg = '환영합니다.';

        self.sendMessage(msg, () => {
          resolve(true);
        });
      } catch (error) {
        logger.error('Error startMsg: ', error);
        let msg = '서비스에 문제가 발생하였습니다.\n종료합니다.';
        self.sendMessage(msg, () => {
          self.sendCommand('botEnd');
        });
      }
    });
  });
}