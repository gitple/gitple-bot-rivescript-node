Gitple bot in rivescript 
---------------------------

## Simple example code

![Rivescript example](/docs/rivescript_example.png)


## Full example code - Sandwich self-order

- After user made an order, it is appened the google sheet shared between chatbot and Chef.
- Chef can get an notification whenever there's update in the google sheet.

see code [rivescript/ directory](/rivescript/sandwich/)

Live demo at [gitple.io](https://gitple.io) : Launch Chat -> Custom Bot -> Sandwich Deliver Order

![Sandwich self-order](/docs/sandwich_order.jpg)

## prerequisite

see https://github.com/gitple/gitple-bot-node/blob/master/README.md

## How to Use

0. config files
You can set your config file as a environment variable: `BOT_MANAGER_CONFIG_FILE`
  - default file: `./config.json`
  - How to get config.json here: see https://github.com/gitple/gitple-bot-node#prerequisite

You can set your rivescript bot config file as a environment variable: `BOT_SETTING_FILE`
  - default file: `./bot_setting.json`

1. Put your rivescript into `rivescript/` directory.

You can set your rivesript path as as a environment variable:`BOT_RIVESCRIPT_DIR`

2. run

```
BOT_MANAGER_CONFIG_FILE=./myconfig.json \
BOT_SETTING_FILE=./mybot_setting.json \
BOT_RIVESCRIPT_DIR=./rivescript/sandwich/sandwich_order \
npm run start
```

## Note

- `store/` directory has the files which have bot instance's state. They are saved for bot recoveries.

License
----------
   Copyright 2017 Gitple Inc.
