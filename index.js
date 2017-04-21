'use strict';

let fs = require('fs');
let path = require('path');
let yaml = require('js-yaml');

let safeObjVal = (obj, keys) => {
  return keys.reduce((nestedObject, key) => {
    if(nestedObject && key in nestedObject) {
      return nestedObject[key];
    }
    return undefined;
  }, obj);
}
module.exports = (options) => {
  let translationFolder = options.translationFolder;
  let locales = options.locales;
  let defaultLocale = options.defaultLocale || locales[0];
  let translations = {}; // TODO: make this immutable

  let load = () => {
    return new Promise((resolveAll, rejectAll) => {
      fs.readdir(translationFolder, (err, files) => {
        Promise.all(files.map(file => {
          let fileName = file.replace(new RegExp(path.extname(file) + '$'), '');
          return new Promise((resolve, reject) => {
            fs.readFile(`${translationFolder}/${file}`, 'utf8', (err, content) => {
              resolve({[fileName]: yaml.safeLoad(content)});
            });
          });
        })).then((objects) => {
          translations = objects.reduce((result, object) => {
            return Object.assign(result, object);
          }, {});
          resolveAll(translations);
        });
      });
    });
  };

  let translate = (translationRoot, key, locale) => {
    console.log(translationRoot, key, locale);
    if (typeof translationRoot === 'string') {
      locale = key;
      key = translationRoot;
      translationRoot = translations;
    }
    locale = locale || defaultLocale;

    let keySplit = key.split('.');

    return keySplit.reduce((subTree, keyEl) => {
      return safeObjVal(subTree, [keyEl]) || safeObjVal(subTree, [locale, keyEl]) || safeObjVal(subTree, [defaultLocale, keyEl]) || {};
    }, translationRoot) || keySplit[keySplit.length - 1];
  };

  let getLocale = () => {
    return locales[0];
  };

  let getLocales = () => {
    return locales;
  }

  let middleware = (req, res, next) => {
    res.locals.t = translate;
    res.locals.locales = locales;
    res.locals.defaultLocale = defaultLocale;
    res.locals.getLocale = getLocale
    res.locals.getLocales = getLocales
    next();
  };

  return {
    ready: load(),
    t: translate,
    locales: locales,
    defaultLocale: defaultLocale,
    getLocale: getLocale,
    getLocales: getLocales,
    translations: translations,
    middleware: middleware
  };
};