'use strict';

let fs = require('fs');
let path = require('path');
let yaml = require('js-yaml');

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
            console.log(`${translationFolder}/${file}`);
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
    if (typeof translationRoot === 'string') {
      locale = key;
      key = translationRoot;
      translationRoot = translations;
    }
    let keySplit = key.split('.');

    return keySplit.reduce((subTree, keyEl) => {
      return (subTree[keyEl] || subTree[locale][keyEl] || subTree[defaultLocale][keyEl] || {});
    }, translationRoot);
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