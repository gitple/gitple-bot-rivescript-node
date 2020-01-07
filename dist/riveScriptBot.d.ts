import { BotManager, Bot, BotConfig } from 'gitple-bot';
export interface RiveScriptBotSetting {
    id: string;
    name: string;
    msg: {
        start?: string;
        end?: string;
        trigger?: string;
        timeoutMessage?: string;
    };
    riveDir?: string;
    options?: any;
    optionsHidden?: any;
    require?: any;
    noPos?: boolean;
    debug?: boolean;
}
export declare class RiveScriptBot extends Bot {
    static _rs: any;
    static _config: any;
    rsId: string;
    rsName: string;
    _timeout: any;
    static initialize(botMgr: BotManager, cb?: (err: Error) => void): void;
    constructor(botManager: BotManager, botConfig: BotConfig, state?: any);
    startChat(cb?: (err: Error) => void): void;
    handleMqttMessage(message: string, cb?: (err: Error) => void): void;
    sendMqttMessage(message: string, opts?: any, cb?: any): Promise<any>;
    sendMqttCommand(cmd: string | Object, cb?: (err: Error) => void): void;
    finalize(): void;
    endChat(params: any, cb?: (err?: Error) => void): void;
    getRiveScriptReply(msg: any, cb?: (err: Error, reply: string) => void): any;
}
