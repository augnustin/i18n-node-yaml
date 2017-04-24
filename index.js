'use strict';

let fs = require('fs');
let path = require('path');
let yaml = require('js-yaml');

// Utils

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
  let translations = {}; // TODO: make this immutable
  var currentLocale;

  if (!isString(options.translationFolder)) {
    throw('Missing translationFolder');
  }

  if (!isArray(options.locales)) { // TODO: guess those from files
    throw('Missing locales');
  }

  options = Object.assign({}, options, {
    defaultLocale: options.locales[0],
    queryParameter: 'lang',
    cookieName: 'i18n',
  });

  let load = () => {
    return new Promise((resolveAll, rejectAll) => {
      fs.readdir(translationFolder, (err, files) => {
        return Promise.all(files.map(file => {
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
    }).then(() => setLocale(options.defaultLocale));
  };

  let strictTranslate = (translationRoot, path, locale) => {
    if (!isArray(path)) {
      throw('Path should be an array');
    }
    if (!locale) {
      throw('Locale not set');
    }
    if (translationRoot) {
      if (!path.length) {
        return translationRoot[locale] || translationRoot;
      } else {
        let nextPath = path[0];
        let nextRoot = safeObjVal(translationRoot, [nextPath]) || safeObjVal(translationRoot, [locale, nextPath]);
        return strictTranslate(nextRoot, path.slice(1), locale);
      }
    } else {
      return path[path.length - 1];
    }
  };

  let looseTranslate = (translationRoot, path, locale) => {
    if (isString(translationRoot)) { // no translationRoot provided
      locale = path;
      path = translationRoot;
      translationRoot = translations;
    }

    path = isString(path) ? path.split('.') : path;
    locale = locale || options.defaultLocale;
    return strictTranslate(translationRoot, path, locale);
  };

  let guessFromHeaders = req => {
    let languageHeader = safeObjVal(req, ['headers', 'accept-language']);
    if (languageHeader) {
      return languageHeader.split(',').map(language => {
        let preferenceParts = language.trim().split(';q=');
        return {
          locale: preferenceParts[0],
          score: preferenceParts[1] || 1
        };
      }).sort((a, b) => {
        return b.score - a.score;
      }).map(el => el.locale);
    }
    return [];
  };

  let setLocale = (res, locale) => {
    currentLocale = locale;
    res.cookie(options.cookieName, currentLocale, { maxAge: 900000, httpOnly: true });
  };

  let getLocale = () => currentLocale;
  let getLocales = () => options.locales;
  let getTranslations = () => translations;

  let middleware = (req, res, next) => {
    let possibleValues = [
      safeObjVal(req, ['query', options.queryParameter]),
      safeObjVal(req, ['cookies', options.cookieName]),
    ].concat(guessFromHeaders(req));

    let selectedLocale = possibleValues.find(possibleLocale => {
      return options.locales.find((locale) => (possibleLocale === locale));
    }) || defaultLocale;

    setLocale(res, selectedLocale);

    res.locals.t = looseTranslate;
    res.locals.getLocale = getLocale
    res.locals.getLocales = getLocales
    next();
  };

  return {
    ready: load(),
    t: looseTranslate,
    getLocale: getLocale,
    getLocales: getLocales,
    getTranslations: translations,
    middleware: middleware
  };
};