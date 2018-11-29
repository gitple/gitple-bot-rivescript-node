/*
 * Copyright 2017 Gitple Inc.
 */

'use strict';
import RiveScript = require('rivescript');
import {BotManager} from 'gitple-bot';
import {RiveScriptBot} from './riveScriptBot';
import _ = require('lodash');
let botMgrConfig = require(process.env.BOT_MANAGER_CONFIG_FILE || './config.json');
let store = require('json-fs-store')();

RiveScriptBot.initialize();

let botMgr = new BotManager(botMgrConfig);

// on bot start
botMgr.on('start', (botConfig, done) => {
  let myBot = new RiveScriptBot(botMgr, botConfig);

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

  let botConfig =  botRecovery.config;
  let botState =  botRecovery.config;
  let myBot = new RiveScriptBot(botMgr, botConfig, botState);

  if (!myBot) { return; }

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
  } else {
    // After key-in indication for one second, user get sorry message.
    myBot.sendKeyInEvent();

    setTimeout(() => {
      let message = 'I\'m sorry. Please say that again.';
      myBot.sendMessage(message);
    }, 1 * 1000);
  }
});

botMgr.on('timeout', (botId: string) => {
  let bot = botMgr.getBot(botId);
  console.info('[RiveScriptBot] bot timeout, finalize it in 2secs', botId);
  if (bot) { // send botEnd command and finalize in 2 secs.
    bot.sendCommand('botEnd');
    _.delay(() => { bot.finalize(); }, 2000);
  }
});
