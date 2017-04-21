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

  let translate = (translationRoot, path, locale) => {
    if (typeof translationRoot === 'string' || Array.isArray(translationRoot)) {
      // no translationRoot provided
      locale = path;
      path = translationRoot;
      translationRoot = translations;
    }

    path = Array.isArray(path) ? path : path.split('.');
    locale = locale || defaultLocale;

    if ((typeof translationRoot === 'string') || (!path.length)) {
      return translationRoot;
    } else if (translationRoot) {
      translate(translationRoot[path[0]], path.splice(0, 1), locale);
    } else {
      return path[path.length - 1];
    }

    // let searchResult = keySplit.reduce((subTree, keyEl) => {
    //   return safeObjVal(subTree, [keyEl]) || safeObjVal(subTree, [locale, keyEl]) || safeObjVal(subTree, [defaultLocale, keyEl]) || {};
    // }, translationRoot);

    // if (typeof searchResult === 'string') {
    //   return searchResult;
    // } else {
    //   return safeObjVal(searchResult, [locale]) || keySplit[keySplit.length - 1];
    // }
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