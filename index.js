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
        console.log(files);
        Promise.all(files.map(file => {
          let fileName = path.extname(file);
          return new Promise((resolve, reject) => {
            fs.readFile(`${translationFolder}/${file}`, 'utf8', (content) => {
              resolve({[fileName]: yaml.safeLoad(content)});
            });
          });
        })).then((objects) => {
          console.log(objects);
          translations = objects.reduce((result, object) => {
            return Object.assign(result, object);
          }, {});
          console.log(translations);
          resolveAll(translations);
        });
      });
    });
  };

  let translate = (key, locale) => {
    let keySplit = key.split('.');

    return keySplit.reduce((result, keyEl) => {
      if (typeof result !== 'object') return result;
      let subTree = result.tree[keyEl];
      if (subTree) {
        if (typeof subTree === 'string') {
          return subTree;
        } else {
          return {
            tree: subTree,
            localeFiltered: result.localeFiltered
          }
        }
      } else if (!result.localeFiltered) {
        return {
          tree: (result.tree[locale] || result.tree[defaultLocale] || {})[keyEl],
          localeFiltered: true
        };
      } else {
        return;
      }
    }, {tree: translations, localeFiltered: false});
  };

  let middleware = (req, res, next) => {
    res.locals.t = translate;
    res.locals.locales = locales;
    res.locals.defaultLocale = defaultLocale;
    next();
  };

  return {
    ready: load(),
    t: translate,
    locales: locales,
    defaultLocale: defaultLocale,
    translations: translations,
    middleware: middleware
  };
};