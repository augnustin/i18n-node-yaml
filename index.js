'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Utils

const safeObjVal = (obj, keys) => {
  return keys.reduce((nestedObject, key) => {
    return nestedObject && nestedObject[key];
  }, obj);
};

const isString = (val) => {
  return typeof val === 'string';
};

const isArray = (val) => {
  return Array.isArray(val);
};

const isObject = (val) => {
  return (val instanceof Object) && !isArray(val);
};

const isLanguage = (localeOrLanguage) => (localeOrLanguage && (localeOrLanguage.split('_').length === 1));

const localeToLanguage = (locale) => (locale.split('_').shift());

const languageToLocale = (language, locales) => locales.find(loc => (localeToLanguage(loc) === language));

const compareLocales = (localeOrLanguage, locale) => {
  if (isLanguage(localeOrLanguage)) {
    return localeOrLanguage === localeToLanguage(locale);
  }
  return localeOrLanguage === locale;
};


module.exports = (options) => {
  let translations; // TODO: make this immutable

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

  const warnResult = function(result, warningString) {
    const args = Array.prototype.slice.call(arguments);
    if (options.debug) {
      console.warn.apply(null, [warningString, result].concat(args.slice(2)));
    }
    return result;
  };

  const doReplaceData = (string, replaceData) => {
    if (!isString(string)) return string;
    return string.replace(/\$\{(.+?)\}/g, (fullMatch, subMatch) => {
      return replaceData[subMatch] || warnResult(subMatch, 'Missing interpolation:');
    });
  };

  const load = () => {
    return new Promise((resolveAll, rejectAll) => {
      fs.readdir(options.translationFolder, (err, files) => {
        return Promise.all(files.map(file => {
          const fileName = file.replace(new RegExp(path.extname(file) + '$'), '');
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

  const strictTranslate = (translationRoot, path, replaceData, locale) => {
    if (translationRoot) {
      if (!path.length) {
        return doReplaceData(translationRoot[locale] || translationRoot[localeToLanguage(locale)] || translationRoot, replaceData);
      } else {
        const nextPath = path[0];
        const nextRoot =
          safeObjVal(translationRoot, [nextPath]) ||
          safeObjVal(translationRoot, [locale, nextPath]) ||
          safeObjVal(translationRoot, [localeToLanguage(locale), nextPath]);
        return strictTranslate(nextRoot, path.slice(1), replaceData, locale);
      }
    } else {
      const lastPath = path[path.length - 1];
      if (lastPath) {
        return warnResult(lastPath, 'Wrong path to translation', path);
      }
    }
  };

  const looseTranslate = (arg1, arg2, arg3, arg4, selectedLocale) => {
    let translationRoot, path, replaceData;
    let partitionArgs = [arg1, arg2, arg3, arg4].reduce((result, arg) => {
      let isLocale = isString(arg) && options.locales.indexOf(arg) > -1;
      return {
        locale: isLocale ? arg : result.locale,
        otherArgs: result.otherArgs.concat(isLocale ? [] : [arg])
      };
    }, {
      locale: selectedLocale,
      otherArgs: []
    });
    let args = partitionArgs.otherArgs;
    let locale = partitionArgs.locale;

    if (isString(args[0])) { // no translationRoot provided
      translationRoot = translations;
      path = args.shift();
    } else {
      translationRoot = args.shift();
      path = args.shift();
    }
    replaceData = args.shift() || {};

    // console.log('from', arg1, arg2, arg3, arg4, selectedLocale);
    // console.log('get', translationRoot, path, replaceData, locale);
    return strictTranslate(translationRoot, path.split('.'), replaceData, locale);
  };

  const guessFromHeaders = req => {
    const languageHeader = safeObjVal(req, ['headers', 'accept-language']);
    if (languageHeader) {
      return languageHeader.split(',').map(language => {
        const preferenceParts = language.trim().split(';q=');
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

  const findBestLocale = (queriedValues) => {
    return queriedValues.filter(val => Boolean(val)).map(queriedValue => {
      if (isLanguage(queriedValue)) return languageToLocale(queriedValue, options.locales);
      return queriedValue;
    }).find(queriedLocale => options.locales.find(locale => locale === queriedLocale)) || options.defaultLocale;
  };

  const setLocale = (res, locale) => {
    res.cookie(options.cookieName, locale, { maxAge: 900000, httpOnly: true });
  };

  const addSelectedLocaleArgumentIfNotPresent = (args, selectedLocale) => {
    if (config.locales.indexOf(args[args.length -1]) == -1) {
      return args.concat(selectedLocale);
    }
    return args;
  };

  const api = (selectedLocale) => {
    selectedLocale = selectedLocale || options.defaultLocale;
    return {
      getLocale: () => selectedLocale,
      getLanguage: () => localeToLanguage(selectedLocale),
      getLocales: () => options.locales,
      getLanguages: () => options.locales.map(localeToLanguage),
      t: (arg1, arg2, arg3, arg4) => looseTranslate(arg1, arg2, arg3, arg4, selectedLocale),
    };
  };

  const middleware = (req, res, next) => {
    const queriedValues =
      options.queryParameters.map(param => safeObjVal(req, ['query', param]))
        .concat([safeObjVal(req, ['cookies', options.cookieName]),])
        .concat(guessFromHeaders(req));

    const selectedLocale = findBestLocale(queriedValues);
    setLocale(res, selectedLocale);

    let selectedApi = api(selectedLocale);
    Object.keys(selectedApi).forEach(key => {
      res.locals[key] = selectedApi[key];
      req[key] = selectedApi[key];
    });

    next();
  };

  return {
    ready: load(),
    middleware: middleware,
    api: api,
  };
};
