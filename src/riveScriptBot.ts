'use strict';

import * as _ from 'lodash';
import * as async from 'async';
import logger = require('winston');
import * as nlp from './nlp';
import {BotManager, Bot, BotConfig} from 'gitple-bot';
/* tslint:disable:variable-name */
import RiveScript = require('rivescript');

const botName = process.env.BOT_NAME;

if (!process.env.MECAB_LIB_PATH) { process.env.MECAB_LIB_PATH = '/usr/local'; }

const ONE_MIN_IN_MS = 60 * 1000; // user timeout check
const BOT_TIMEOUT = 4 * 60 * 1000; // user timeout
const BOT_REPLY_TIMEOUT = 10 * 1000; // bot timeout leads transfering to agent
const MESSAGE_DELAY = 500;           // intentional message delay

// logger.level = 'debug';

export interface RiveScriptBotSetting {
  id: string;
  name: string;
  msg: {
    start?: string;
    end?: string;
    trigger?: string;
    timeoutMessage?: string;
  };
  riveDir?: string;      // path for rivescript files
  options?: any;
  optionsHidden?: any;  // hidden options
  require?: any;        // requied modules
  noPos?: boolean;      // disable POS tagging?
  debug?: boolean;
}

export class RiveScriptBot extends Bot {
  static _rs: any;
  static _config: any;

  //mqttClient: any;
  rsId: string;
  rsName: string;
  _timeout: any;

  static initialize(botMgr: BotManager, cb?: (err: Error) => void)  {
    let rsBotSetting: RiveScriptBotSetting = require(process.env.BOT_SETTING_FILE || '../bot_setting.json')[botName];
    rsBotSetting.options = _.defaults(rsBotSetting.optionsHidden, rsBotSetting.options);

    RiveScriptBot._rs = new RiveScript({
      utf8: true,
      onDebug: logger.error,
      debug: rsBotSetting.debug ? true : false,
    });
    RiveScriptBot._config = rsBotSetting;
    RiveScriptBot._rs.utils = {};
    _.each(rsBotSetting.require, (mod: any, name: string) => {
      RiveScriptBot._rs.utils[name] = require(mod);
    });
    RiveScriptBot._rs.options = rsBotSetting;

    setInterval(() => { // user timeout check
      let now = _.now();
      _.each(botMgr.botInstances, (bot: Bot) => {
        if (now - bot.mtime > BOT_TIMEOUT) {
          logger.error('botEnd due to bot timeout', 'bot', bot.id);
          bot.sendCommand('botEnd');
        }
      });
    }, ONE_MIN_IN_MS);

    async.series([
      (done?: (err?: Error) => void) => { // load rive scripts
        RiveScriptBot._rs.loadDirectory(process.env.BOT_RIVESCRIPT_DIR || RiveScriptBot._rs.options.riveDir || './rivescript',
        () => { // on success
          RiveScriptBot._rs.sortReplies();
          return done();
        }, (err: Error, loadCount: any) => { // on error
          logger.error('Ignoring: Loading fails', RiveScriptBot._rs.options.riveDir, err, loadCount);
          return done(); // ignore error
        });
      },
      (done?: (err: Error) => void) => { // recover existing ones
        // return RiveScriptBot.recoverSessions(done); // FIXME
      }
    ], cb);
  }
  constructor(botManager: BotManager, botConfig: BotConfig, state?: any) {
    super(botManager, botConfig, state);

    this.on('message', this.handleMqttMessage);

    if (state) {
      RiveScriptBot._rs.setUservars(this.id, state);
    } else {
      this.startChat();
    }
  }

  startChat(cb?: (err: Error) => void) {
    var self = this;
    let context = this.config.context;
    let user = _.get(this.config, 'user');
    logger.debug('startChat');

    //set _user
    async.waterfall([
      (done: any) => {
        RiveScriptBot._rs.setUservar(self.id, '_user_id', user && user.id);
        RiveScriptBot._rs.setUservar(self.id, '_user', user);
        RiveScriptBot._rs.setUservar(self.id, '_context', context);

        //send start message
        if (!_.isEmpty(RiveScriptBot._rs.options.msg.start)) {
          this.sendMqttMessage( RiveScriptBot._rs.options.msg.start);
        }

        _.delay(() => {
          //send trigger message
          if (!_.isEmpty(RiveScriptBot._rs.options.msg.trigger)) {
            self.handleMqttMessage(RiveScriptBot._rs.options.msg.trigger);
          }
        }, 1000);
        return done();
      },
    ] , (err: Error) => {
      return cb && cb(err);
    });
  }

  handleMqttMessage(message: string, cb?: (err: Error) => void) {
    let self = this;

    // message: <Message text, html or component>, parsedObj.m);
    logger.debug(`mqtt message - message: ${message}`);

    if (_.isUndefined(message) || _.isNull(message)) {
      logger.debug(`no message`);
      return;
    }

    self._timeout = setTimeout(() => { //transfer to agent on timeout
      self._timeout = null;
      if (_.get(RiveScriptBot._rs, 'options.msg.timeoutMessage')) {
        self.sendMqttMessage(RiveScriptBot._rs.options.msg.timeoutMessage);
      }
      logger.error('transferToAgent due to bot timeout', 'bot', self.id, 'msg', message);
      return self.sendCommand('transferToAgent');
    }, BOT_REPLY_TIMEOUT);

    self.sendKeyInEvent();

    self.getRiveScriptReply(message, async (err: Error, reply: string) => {
      if (self._timeout) {
        clearTimeout(self._timeout);
        self._timeout = null;
      } else { // ignore on timeout
        return;
      }

      let cmd = await RiveScriptBot._rs.getUservar(self.id, '_cmd');

      if (err) {
        logger.error('handleMqttMessage() getRiveScriptReply failure', err);
      } else {
        if (_.isUndefined(reply) || _.isNull(reply) || reply === '') {
          logger.info('handleMqttMessage() getRiveScriptReply invalid reply', self.id, cmd, '/', message, '=>', reply);
        } else {
          self.sendMqttMessage(reply, null, (err: Error) => {
            if (err) {
              logger.error('handleMqttMessage() mqtt publish', self.id, message, cmd, err);
            }
          });
          logger.debug('handleMqttMessage() mqtt publish', self.id);
        }
      }

      // set state before save
      self.state = await RiveScriptBot._rs.getUservars(self.id);
      self.saveState();

      if (cmd && cmd !== 'null' && cmd !== 'undefined') { // undefined string
        RiveScriptBot._rs.setUservar(self.id, '_cmd', null); //reset cmd
        try {
          cmd = JSON.parse(cmd);
        } catch (err) {
          logger.error('handleMqttMessage()', self.id, typeof cmd, cmd, err);
        }
        return self.sendMqttCommand(cmd, cb);
      }

      return cb && cb(err);
    });
  }

  async sendMqttMessage(message: string, opts?: any, cb?: any) {
    let self = this;
    let context = await RiveScriptBot._rs.getUservar(self.id, '_context');

    if (_.isNil(message)) {
      logger.info('mqtt publish: ignore nil message', self.id, JSON.stringify(message));
    }

    message = _.trim(message);

    if (message === '') {
      return cb && cb(new Error('message is empty string; id=' + self.id));
    }

    try { message = JSON.parse(message); } catch (e) {
      // do nothing
    }

    if (MESSAGE_DELAY > 0) {
      _.delay(() => { self.sendMessage(message, cb); }, MESSAGE_DELAY);
    }

    logger.debug('mqtt publish', self.id, JSON.stringify(message));
  }


  sendMqttCommand(cmd: string|Object, cb?: (err: Error) => void) {
    let self = this;
    logger.debug('process command:', self.id, cmd);

    if (_.isObject(cmd))  { cmd = _.keys(cmd)[0]; }

    switch (cmd) {
        case 'quit':
        case 'end':
          self.sendCommand('botEnd');
        break;

        case 'transfer':
          self.sendCommand('transferToAgent');
        break;

        default:
        logger.error(`sendMqttCommand() unknown command ${self.id} ${cmd}`);

    }
    return cb && cb(null);
  }

  finalize() {
    let self = this;
    super.finalize();

    logger.debug('finalize');

    //delete room and mqtt unsubscribe
    RiveScriptBot._rs.clearUservars(self.id);

    return;
  }

  endChat(params: any, cb?: (err?: Error) => void) {
    //send end message
    if (!_.isEmpty(RiveScriptBot._rs.options.msg.end)) {
      this.sendMqttMessage(RiveScriptBot._rs.options.msg.end);
    }

    this.finalize();

    return cb && cb();
  }

  getRiveScriptReply(msg: any, cb?: (err: Error, reply: string) => void) {
    var self = this;
    let lang = 'ko'; //get user's lang

    if (RiveScriptBot._rs.options.noPos) { // unless pos tagging
      return RiveScriptBot._rs.reply(self.id, msg, self).then( async (reply: any) => {
        logger.debug('initialMatch', RiveScriptBot._rs.initialMatch(self.id));
        logger.debug('lastMatch', RiveScriptBot._rs.lastMatch(self.id));
        logger.debug('input', await RiveScriptBot._rs.getUservar(self.id, 'input')[0]);
        //send to mqtt
        //logger.debug('user vars', await RiveScriptBot._rs.getUservars(self.id));
        return cb && cb.call(this, null, reply);
      }).catch((err: Error) => {
        return cb && cb.call(this, err);
      });
    }

    nlp.orgform(msg, lang, async (err: Error, tags: any[]) => {
      let words = [];
      _.each(tags, (t) => {
        words.push(t[0]);
      });
      let normMsg = words.join(' ');
      //set variable: with pos
      RiveScriptBot._rs.setUservar(self.id, '_pos', _.flatten(tags).toString());
      RiveScriptBot._rs.setUservar(self.id, '_org', msg);
      logger.debug('normalized input msg:', normMsg);
      logger.debug('_pos', await RiveScriptBot._rs.getUservar(self.id, '_pos'));
      logger.debug('_org', msg);
      return RiveScriptBot._rs.reply(self.id, normMsg, self).then( async (reply: any) => {
        logger.debug('initialMatch', RiveScriptBot._rs.initialMatch(self.id));
        logger.debug('lastMatch', RiveScriptBot._rs.lastMatch(self.id));
        logger.debug('input', await RiveScriptBot._rs.getUservar(self.id, 'input')[0]);
        //send to mqtt
        //logger.debug('user vars', await RiveScriptBot._rs.getUservars(self.id));
        return cb && cb.call(this, null, reply);
      }).catch((err: Error) => {
        return cb && cb.call(this, err);
      });
    });
  }
}
