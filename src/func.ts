import logger = require('winston');
import * as _ from 'lodash';

// tslint:disable-next-line:variable-name
export function funcInitialize(RiveScriptBot: any) {
  // bot start message
  RiveScriptBot._rs.setSubroutine('startMsg', function (rs: any, args: any) {
    return new rs.Promise(async (resolve: any, reject: any) => {
      const self = this;
      try {
        const msg = 'Welcome. Gitple.\n';

        resolve(msg);
      } catch (error) {
        logger.error('Error startMsg: ', error);
        let msg = 'I\'m sorry. Please say that again.';
        self.sendMessage(msg, () => {
          self.sendCommand('botEnd');
        });
      }
    });
  });
}