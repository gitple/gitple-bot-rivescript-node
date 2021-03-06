/*
 * Copyright 2017 Gitple Inc.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const gitple_bot_1 = require("gitple-bot");
const riveScriptBot_1 = require("./riveScriptBot");
const _ = require("lodash");
const async = require("async");
const func = require("./func");
let botMgrConfig = require(process.env.BOT_MANAGER_CONFIG_FILE || '../config.json');
let store = require('json-fs-store')();
const botName = process.env.BOT_NAME;
let botMgr = new gitple_bot_1.BotManager(botMgrConfig);
riveScriptBot_1.RiveScriptBot.initialize(botMgr);
// Add rivescript custom function, $ npm run guide
if (botName === 'guide') {
    func.funcInitialize(riveScriptBot_1.RiveScriptBot);
}
// on bot start
botMgr.on('start', (botConfig, done) => {
    let myBot = new riveScriptBot_1.RiveScriptBot(botMgr, botConfig);
    console.log(`[RiveScriptBot] start bot ${myBot.id}. user identifier:`, _.get(botConfig, 'user.identifier'));
    return done && done();
});
// on bot end
botMgr.on('end', (botId, done) => {
    let bot = botMgr.getBot(botId);
    console.log(`[RiveScriptBot] end bot ${bot && bot.id}. user identifier:`, _.get(bot, 'config.user.identifier'));
    if (bot) {
        bot.finalize();
    }
    // do something
    return done && done();
});
botMgr.on('error', (err) => {
    console.error('[RiveScriptBot] error', err);
});
botMgr.on('connect', () => {
    console.info('[RiveScriptBot] connect');
});
botMgr.on('reconnect', () => {
    console.info('[RiveScriptBot] reconnect');
});
botMgr.on('disconnect', () => {
    console.info('[RiveScriptBot] disconnect');
});
botMgr.on('ready', () => {
    console.info('[RiveScriptBot] ready');
});
// on bot recovery from stored info
botMgr.on('recovery', (botRecovery) => {
    let botConfig = botRecovery.config;
    let botState = botRecovery.state;
    let myBot = new riveScriptBot_1.RiveScriptBot(botMgr, botConfig, botState);
    if (!myBot) {
        return;
    }
    console.log(`[botMgr] recovery bot ${myBot.id}. ${botRecovery.savedTime} user identifier:`, _.get(botConfig, 'user.identifier'));
    const BOT_TTL = 5 * 60 * 1000; // 5min
    let savedTime = botRecovery.savedTime;
    if (Date.now() - savedTime > BOT_TTL) { // End bot if it has been more than BOT_TTL
        myBot.sendCommand('botEnd'); // request to end my bot
        _.delay(() => {
            if (botMgr.getBot(myBot.id)) {
                myBot.finalize();
            }
        }, 2000);
    }
    else {
        // After key-in indication for one second, user get sorry message.
        myBot.sendKeyInEvent();
        setTimeout(() => {
            let message = 'I\'m sorry. Please say that again.';
            myBot.sendMessage(message);
        }, 1 * 1000);
    }
});
botMgr.on('timeout', (botId) => {
    let bot = botMgr.getBot(botId);
    console.info('[RiveScriptBot] bot timeout, finalize it in 2secs', botId);
    if (bot) { // send botEnd command and finalize in 2 secs.
        bot.sendCommand('botEnd');
        _.delay(() => { bot.finalize(); }, 2000);
    }
});
function saveAllBot(cb) {
    let allBots = botMgr.getAllBots();
    async.eachSeries(allBots, (myBot, done) => {
        myBot.saveState(done);
    }, (err) => {
        return cb && cb(err);
    });
}
function finalize(cb) {
    saveAllBot(() => {
        try {
            botMgr.finalize(cb);
        }
        catch (e) {
            return cb && cb();
        }
    });
}
process.on('SIGINT', function () {
    console.info('SIGINT');
    try {
        finalize(() => {
            process.exit();
        });
    }
    catch (e) {
        process.exit();
    }
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});
