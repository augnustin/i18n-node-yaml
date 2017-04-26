'use strict';

let fs = require('fs');
let path = require('path');
let yaml = require('js-yaml');

// Utils

let safeObjVal = (obj, keys) => {
  return keys.reduce((nestedObject, key) => {
    return nestedObject && nestedObject[key];
  }, obj);
};

let isString = (val) => {
  return typeof val === 'string';
};

let isArray = (val) => {
  return Array.isArray(val);
};

let isLanguage = (localeOrLanguage) => (localeOrLanguage && (localeOrLanguage.split('_').length === 1));

let localeToLanguage = (locale) => (locale.split('_').shift());

let compareLocales = (localeOrLanguage, locale) => {
  if (isLanguage(localeOrLanguage)) {
    return localeOrLanguage === localeToLanguage(locale);
  }
  return localeOrLanguage === locale;
}

module.exports = (options) => {
  let translations = {}; // TODO: make this immutable
  let currentLocale;

  if (!isString(options.translationFolder)) {
    throw('Missing translationFolder');
  }

  if (!isArray(options.locales)) { // TODO: guess those from files
    throw('Missing locales');
  }

  options = Object.assign({}, options, {
    defaultLocale: options.locales[0],
    queryParameters: ['lang'],
    cookieName: 'i18n',
  });

  let load = () => {
    return new Promise((resolveAll, rejectAll) => {
      fs.readdir(options.translationFolder, (err, files) => {
        return Promise.all(files.map(file => {
          let fileName = file.replace(new RegExp(path.extname(file) + '$'), '');
          return new Promise((resolve, reject) => {
            fs.readFile(`${options.translationFolder}/${file}`, 'utf8', (err, content) => {
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
    }).catch(err => rejectAll('Error loading content:', err));
  };

  let strictTranslate = (translationRoot, path, locale) => {
    if (translationRoot) {
      if (!path.length) {
        return translationRoot[locale] || translationRoot[localeToLanguage(locale)] || translationRoot;
      } else {
        let nextPath = path[0];
        let nextRoot =
          safeObjVal(translationRoot, [nextPath]) ||
          safeObjVal(translationRoot, [locale, nextPath]) ||
          safeObjVal(translationRoot, [localeToLanguage(locale), nextPath]);
        return strictTranslate(nextRoot, path.slice(1), locale);
      }
    } else {
      return path[path.length - 1];
    }
  };

  let looseTranslate = (translationRoot, path, locale) => {
    if (isString(translationRoot)) { // no translationRoot provided
      path = translationRoot;
      translationRoot = translations;
    }
    return strictTranslate(translationRoot, path.split('.'), locale);
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
    res.cookie(options.cookieName, locale, { maxAge: 900000, httpOnly: true });
  };

  let getLocales = () => options.locales;
  let getTranslations = () => translations;

  let middleware = (req, res, next) => {
    let possibleValues = options.queryParameters.map(possibleParam => safeObjVal(req, ['query', possibleParam])).concat([
      safeObjVal(req, ['cookies', options.cookieName]),
    ]).concat(guessFromHeaders(req));

    let selectedLocale = possibleValues.find(possibleLocale => {
      return options.locales.find((locale) => compareLocales(possibleLocale, locale));
    }) || options.defaultLocale;

    console.log('heey', possibleValues, selectedLocale);

    setLocale(res, selectedLocale);

    res.locals.getLocale = () => selectedLocale;
    res.locals.getLanguage = () => localeToLanguage(selectedLocale);
    res.locals.getLocales = () => options.locales;
    res.locals.getLanguages = () => options.locales.map(localeToLanguage);
    res.locals.t = (translationRoot, path, locale) => looseTranslate(translationRoot, path, locale || selectedLocale);
    next();
  };

  return {
    ready: load(),
    middleware: middleware
  };
};