'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const async = require("async");
const logger = require("winston");
const nlp = require("./nlp");
const gitple_bot_1 = require("gitple-bot");
/* tslint:disable:variable-name */
const RiveScript = require("rivescript");
const botName = process.env.BOT_NAME;
if (!process.env.MECAB_LIB_PATH) {
    process.env.MECAB_LIB_PATH = '/usr/local';
}
const ONE_MIN_IN_MS = 60 * 1000; // user timeout check
const BOT_TIMEOUT = 4 * 60 * 1000; // user timeout
const BOT_REPLY_TIMEOUT = 10 * 1000; // bot timeout leads transfering to agent
const MESSAGE_DELAY = 500; // intentional message delay
class RiveScriptBot extends gitple_bot_1.Bot {
    static initialize(botMgr, cb) {
        let rsBotSetting = require(process.env.BOT_SETTING_FILE || '../bot_setting.json')[botName];
        rsBotSetting.options = _.defaults(rsBotSetting.optionsHidden, rsBotSetting.options);
        RiveScriptBot._rs = new RiveScript({
            utf8: true,
            onDebug: logger.error,
            debug: rsBotSetting.debug ? true : false,
        });
        RiveScriptBot._config = rsBotSetting;
        RiveScriptBot._rs.utils = {};
        _.each(rsBotSetting.require, (mod, name) => {
            RiveScriptBot._rs.utils[name] = require(mod);
        });
        RiveScriptBot._rs.options = rsBotSetting;
        setInterval(() => {
            let now = _.now();
            _.each(botMgr.botInstances, (bot) => {
                if (now - bot.mtime > BOT_TIMEOUT) {
                    logger.error('botEnd due to bot timeout', 'bot', bot.id);
                    bot.sendCommand('botEnd');
                }
            });
        }, ONE_MIN_IN_MS);
        async.series([
            (done) => {
                RiveScriptBot._rs.loadDirectory(process.env.BOT_RIVESCRIPT_DIR || RiveScriptBot._rs.options.riveDir || './rivescript', () => {
                    RiveScriptBot._rs.sortReplies();
                    return done();
                }, (err, loadCount) => {
                    logger.error('Ignoring: Loading fails', RiveScriptBot._rs.options.riveDir, err, loadCount);
                    return done(); // ignore error
                });
            },
            (done) => {
                // return RiveScriptBot.recoverSessions(done); // FIXME
            }
        ], cb);
    }
    constructor(botManager, botConfig, state) {
        super(botManager, botConfig, state);
        this.on('message', this.handleMqttMessage);
        if (state) {
            RiveScriptBot._rs.setUservars(this.id, state);
        }
        else {
            this.startChat();
        }
    }
    startChat(cb) {
        var self = this;
        let context = this.config.context;
        let user = _.get(this.config, 'user');
        logger.debug('startChat');
        //set _user
        async.waterfall([
            (done) => {
                RiveScriptBot._rs.setUservar(self.id, '_user_id', user && user.id);
                RiveScriptBot._rs.setUservar(self.id, '_user', user);
                RiveScriptBot._rs.setUservar(self.id, '_context', context);
                //send start message
                if (!_.isEmpty(RiveScriptBot._rs.options.msg.start)) {
                    this.sendMqttMessage(RiveScriptBot._rs.options.msg.start);
                }
                _.delay(() => {
                    //send trigger message
                    if (!_.isEmpty(RiveScriptBot._rs.options.msg.trigger)) {
                        self.handleMqttMessage(RiveScriptBot._rs.options.msg.trigger);
                    }
                }, 1000);
                return done();
            },
        ], (err) => {
            return cb && cb(err);
        });
    }
    handleMqttMessage(message, cb) {
        let self = this;
        // message: <Message text, html or component>, parsedObj.m);
        logger.debug(`mqtt message - message: ${message}`);
        if (_.isUndefined(message) || _.isNull(message)) {
            logger.debug(`no message`);
            return;
        }
        self._timeout = setTimeout(() => {
            self._timeout = null;
            if (_.get(RiveScriptBot._rs, 'options.msg.timeoutMessage')) {
                self.sendMqttMessage(RiveScriptBot._rs.options.msg.timeoutMessage);
            }
            logger.error('transferToAgent due to bot timeout', 'bot', self.id, 'msg', message);
            return self.sendCommand('transferToAgent');
        }, BOT_REPLY_TIMEOUT);
        self.sendKeyInEvent();
        self.getRiveScriptReply(message, (err, reply) => __awaiter(this, void 0, void 0, function* () {
            if (self._timeout) {
                clearTimeout(self._timeout);
                self._timeout = null;
            }
            else { // ignore on timeout
                return;
            }
            let cmd = yield RiveScriptBot._rs.getUservar(self.id, '_cmd');
            if (err) {
                logger.error('handleMqttMessage() getRiveScriptReply failure', err);
            }
            else {
                if (_.isUndefined(reply) || _.isNull(reply) || reply === '') {
                    logger.info('handleMqttMessage() getRiveScriptReply invalid reply', self.id, cmd, '/', message, '=>', reply);
                }
                else {
                    self.sendMqttMessage(reply, null, (err) => {
                        if (err) {
                            logger.error('handleMqttMessage() mqtt publish', self.id, message, cmd, err);
                        }
                    });
                    logger.debug('handleMqttMessage() mqtt publish', self.id);
                }
            }
            // set state before save
            self.state = yield RiveScriptBot._rs.getUservars(self.id);
            self.saveState();
            if (cmd && cmd !== 'null' && cmd !== 'undefined') { // undefined string
                RiveScriptBot._rs.setUservar(self.id, '_cmd', null); //reset cmd
                try {
                    cmd = JSON.parse(cmd);
                }
                catch (err) {
                    logger.error('handleMqttMessage()', self.id, typeof cmd, cmd, err);
                }
                return self.sendMqttCommand(cmd, cb);
            }
            return cb && cb(err);
        }));
    }
    sendMqttMessage(message, opts, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            let context = yield RiveScriptBot._rs.getUservar(self.id, '_context');
            if (_.isNil(message)) {
                logger.info('mqtt publish: ignore nil message', self.id, JSON.stringify(message));
            }
            message = _.trim(message);
            if (message === '') {
                return cb && cb(new Error('message is empty string; id=' + self.id));
            }
            try {
                message = JSON.parse(message);
            }
            catch (e) {
                // do nothing
            }
            if (MESSAGE_DELAY > 0) {
                _.delay(() => { self.sendMessage(message, cb); }, MESSAGE_DELAY);
            }
            logger.debug('mqtt publish', self.id, JSON.stringify(message));
        });
    }
    sendMqttCommand(cmd, cb) {
        let self = this;
        logger.debug('process command:', self.id, cmd);
        if (_.isObject(cmd)) {
            cmd = _.keys(cmd)[0];
        }
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
    endChat(params, cb) {
        //send end message
        if (!_.isEmpty(RiveScriptBot._rs.options.msg.end)) {
            this.sendMqttMessage(RiveScriptBot._rs.options.msg.end);
        }
        this.finalize();
        return cb && cb();
    }
    getRiveScriptReply(msg, cb) {
        var self = this;
        let lang = 'ko'; //get user's lang
        if (RiveScriptBot._rs.options.noPos) { // unless pos tagging
            return RiveScriptBot._rs.reply(self.id, msg, self).then((reply) => __awaiter(this, void 0, void 0, function* () {
                logger.debug('initialMatch', RiveScriptBot._rs.initialMatch(self.id));
                logger.debug('lastMatch', RiveScriptBot._rs.lastMatch(self.id));
                logger.debug('input', yield RiveScriptBot._rs.getUservar(self.id, 'input')[0]);
                //send to mqtt
                //logger.debug('user vars', await RiveScriptBot._rs.getUservars(self.id));
                return cb && cb.call(this, null, reply);
            })).catch((err) => {
                return cb && cb.call(this, err);
            });
        }
        nlp.orgform(msg, lang, (err, tags) => __awaiter(this, void 0, void 0, function* () {
            let words = [];
            _.each(tags, (t) => {
                words.push(t[0]);
            });
            let normMsg = words.join(' ');
            //set variable: with pos
            RiveScriptBot._rs.setUservar(self.id, '_pos', _.flatten(tags).toString());
            RiveScriptBot._rs.setUservar(self.id, '_org', msg);
            logger.debug('normalized input msg:', normMsg);
            logger.debug('_pos', yield RiveScriptBot._rs.getUservar(self.id, '_pos'));
            logger.debug('_org', msg);
            return RiveScriptBot._rs.reply(self.id, normMsg, self).then((reply) => __awaiter(this, void 0, void 0, function* () {
                logger.debug('initialMatch', RiveScriptBot._rs.initialMatch(self.id));
                logger.debug('lastMatch', RiveScriptBot._rs.lastMatch(self.id));
                logger.debug('input', yield RiveScriptBot._rs.getUservar(self.id, 'input')[0]);
                //send to mqtt
                //logger.debug('user vars', await RiveScriptBot._rs.getUservars(self.id));
                return cb && cb.call(this, null, reply);
            })).catch((err) => {
                return cb && cb.call(this, err);
            });
        }));
    }
}
exports.RiveScriptBot = RiveScriptBot;
