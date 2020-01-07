'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
if (!process.env.MECAB_LIB_PATH) {
    process.env.MECAB_LIB_PATH = '/usr/local';
}
var mecab = require('mecab-ya');
var posEn = require('pos'); //en
var taggerEn = new posEn.Tagger();
function orgformGet(req, res, next) {
    let lang = req.query.lang || 'ko';
    let q = req.query && req.query.q;
    if (_.isEmpty(q)) {
        //res.statusCode = 400;
        return res.status(400).send({ error: 'q param is missing' });
    }
    orgform(q, lang, (err, tags) => {
        if (lang === 'en') {
            let _words = new posEn.Lexer().lex(q);
            let tags = taggerEn.tag(_words);
            let words = [];
            _.each(tags, (t) => {
                let w = t[0];
                let tag = t[1];
                if (/[A-Z]/.test(tag) === true && tag !== 'SYM') { //ignore symbol
                    words.push(w);
                }
            });
            return res.status(200).send({ a: words.join(' '), tags: tags });
        }
        else { // default ko
            if (err) {
                return res.status(400).send({ error: err.toString() });
            }
            let words = [];
            _.each(tags, (t) => {
                words.push(t[0]);
            });
            return res.status(200).send({ a: words.join(' '), tags: tags });
        }
    });
}
exports.orgformGet = orgformGet;
function orgform(q, lang, cb) {
    if (lang === 'en') {
        let _words = new posEn.Lexer().lex(q);
        let tags = taggerEn.tag(_words);
        return cb && cb(null, tags); //FIXME: remove funtuation pos
    }
    else { // default ko
        mecab.orgform(q, cb);
    }
}
exports.orgform = orgform;
