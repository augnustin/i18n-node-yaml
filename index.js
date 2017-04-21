'use strict';

let fs = require('fs');
let path = require('path');
let yaml = require('js-yaml');

let safeObjVal = (obj, keys) => {
  return keys.reduce((nestedObject, key) => {
    if(nestedObject && nestedObject.hasOwnProperty(key)) {
      return nestedObject[key];
    }
    return undefined;
  }, obj);
};

let isString = (val) => {
  return typeof val === 'string';
};

let isArray = (val) => {
  return Array.isArray(val);
};

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
          console.log(translations);
          resolveAll(translations);
        });
      });
    });
  };

  let translate = (translationRoot, path, locale) => {
    if (isString(translationRoot) || isArray(translationRoot)) {
      // no translationRoot provided
      locale = path;
      path = translationRoot;
      translationRoot = translations;
    }

    path = isString(path) ? path.split('.') : path;
    locale = locale || defaultLocale;

    if (!isArray(path)) {
      raise('Path should be an array', path);
    }
    console.log('executing with', translationRoot, path, locale);
    if (!path.length) {
      return translationRoot[locale] || translationRoot;
    } else if (translationRoot) {
      let nextPath = path[0];
      let nextRoot = safeObjVal(translationRoot, [nextPath]) || safeObjVal(translationRoot, [locale, nextPath]);
      return translate(nextRoot, path.slice(1), locale);
    } else {
      return path[path.length - 1];
    }
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