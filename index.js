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

let languageToLocale = (language, locales) => locales.find(loc => (localeToLanguage(loc) === language));

let compareLocales = (localeOrLanguage, locale) => {
  if (isLanguage(localeOrLanguage)) {
    return localeOrLanguage === localeToLanguage(locale);
  }
  return localeOrLanguage === locale;
};


module.exports = (options) => {
  let translations = {}; // TODO: make this immutable
  let currentLocale;

  if (!isString(options.translationFolder)) {
    throw('Missing translationFolder');
  }

  if (!isArray(options.locales)) { // TODO: guess those from files
    throw('Missing locales');
  }

  options = Object.assign({
    debug: false,
    defaultLocale: options.locales[0],
    queryParameters: ['lang'],
    cookieName: 'i18n',
  }, options);

  let warnResult = function(result, warningString) {
    let args = Array.prototype.slice.call(arguments);
    if (options.debug) {
      console.warn.apply(null, [warningString, result].concat(args.slice(2)));
    }
    return result;
  };

  let doReplaceData = (string, replaceData) => {
    if (!isString(string)) return string;
    return string.replace(/\$\{(.+)\}/g, (fullMatch, subMatch) => {
      return replaceData[subMatch] || warnResult(subMatch, 'Missing interpolation:');
    });
  };

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

  let strictTranslate = (translationRoot, path, replaceData, locale) => {
    if (translationRoot) {
      if (!path.length) {
        return doReplaceData(translationRoot[locale] || translationRoot[localeToLanguage(locale)] || translationRoot, replaceData);
      } else {
        let nextPath = path[0];
        let nextRoot =
          safeObjVal(translationRoot, [nextPath]) ||
          safeObjVal(translationRoot, [locale, nextPath]) ||
          safeObjVal(translationRoot, [localeToLanguage(locale), nextPath]);
        return strictTranslate(nextRoot, path.slice(1), replaceData, locale);
      }
    } else {
      let lastPath = path[path.length - 1];
      if (lastPath) {
        return warnResult(lastPath, 'Wrong path to translation', path);
      }
    }
  };

  let looseTranslate = (translationRoot, path, replaceData, locale) => {
    if (isString(translationRoot)) { // no translationRoot provided
      replaceData = path;
      path = translationRoot;
      translationRoot = translations;
    }
    return strictTranslate(translationRoot, path.split('.'), replaceData  || {}, locale);
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

  let findBestLocale = (queriedValues) => {
    return queriedValues.filter(val => Boolean(val)).map(queriedValue => {
      if (isLanguage(queriedValue)) return languageToLocale(queriedValue, options.locales);
      return queriedValue;
    }).find(queriedLocale => options.locales.find(locale => locale === queriedLocale)) || options.defaultLocale;
  };

  let setLocale = (res, locale) => {
    res.cookie(options.cookieName, locale, { maxAge: 900000, httpOnly: true });
  };

  let middleware = (req, res, next) => {
    let queriedValues =
      options.queryParameters.map(param => safeObjVal(req, ['query', param]))
        .concat([safeObjVal(req, ['cookies', options.cookieName]),])
        .concat(guessFromHeaders(req));

    let selectedLocale = findBestLocale(queriedValues);
    setLocale(res, selectedLocale);

    res.locals.getLocale = () => selectedLocale;
    res.locals.getLanguage = () => localeToLanguage(selectedLocale);
    res.locals.getLocales = () => options.locales;
    res.locals.getLanguages = () => options.locales.map(localeToLanguage);
    res.locals.t = (translationRoot, path, replaceData, locale) => looseTranslate(translationRoot, path, replaceData, locale || selectedLocale);
    req.t = res.locals.t;
    next();
  };

  return {
    ready: load(),
    middleware: middleware
  };
};