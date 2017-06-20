'use strict';

const expect = require('chai').expect;

describe('i18n-node-yaml tests', function() {
  const availableLocales = ['en_US', 'fr_FR'];
  let i18n;

  before(function(done) {
    i18n = require('../')({
      debug: true,
      translationFolder: __dirname + '/translations',
      locales: availableLocales,
    });
    i18n.ready.then(() => done());
  });

  describe('#translate', function() {
    context('in English', function() {
      it('should translate a word', function() {
        expect(i18n.api('en_US').t('main.hello.world')).to.equal('Hello World');
      });
      it('should return an international word', function() {
        expect(i18n.api('en_US').t('main.foo.bar')).to.equal('Foo bar');
      });
      it('should return an array', function() {
        expect(i18n.api('en_US').t('main.list')).to.be.an('array');
      });
      it('should access array element from Root', function() {
        expect(i18n.api('en_US').t('main.list.0.value')).to.equal('I am crazy');
      });
      it('should access array element from Array', function() {
        let array = i18n.api('en_US').t('main.list');
        expect(i18n.api('en_US').t(array, '1.value')).to.equal('I like bars');
      });
      it('should access array element from Array and override query language', function() {
        let array = i18n.api('en_US').t('main.list');
        expect(i18n.api('fr_FR').t(array, '2.value', 'en_US')).to.equal('I\'m downstairs');
      });
      it('should interpolate', function() {
        expect(i18n.api('en_US').t('main.welcome', {name: 'George Boole'})).to.equal('Welcome George Boole');
      });
      it('should override query language', function() {
        expect(i18n.api('fr_FR').t('main.hello.world', 'en_US')).to.equal('Hello World');
      });
      it('should interpolate and override query language', function() {
        expect(i18n.api('fr_FR').t('main.welcome', {name: 'George Boole'}, 'en_US')).to.equal('Welcome George Boole');
      });
      it('should access array element from Array, interpolate and override query language', function() {
        let array = i18n.api('en_US').t('main.list');
        expect(i18n.api('fr_FR').t(array, '3.value', {content: 'content'}, 'en_US')).to.equal('I can change my content');
      });
    });
    context('in French', function() {
      it('should translate a word', function() {
        expect(i18n.api('fr_FR').t('main.hello.world')).to.equal('Bonjour le monde');
      });
      it('should return an international word', function() {
        expect(i18n.api('fr_FR').t('main.foo.bar')).to.equal('Foo bar');
      });
      it('should return an array', function() {
        expect(i18n.api('fr_FR').t('main.list')).to.be.an('array');
      });
      it('should access array element from Root', function() {
        expect(i18n.api('fr_FR').t('main.list.0.value')).to.equal('Je suis fou');
      });
      it('should access array element from Array', function() {
        let array = i18n.api('fr_FR').t('main.list');
        expect(i18n.api('fr_FR').t(array, '1.value')).to.equal('J\'aime les bars');
      });
      it('should access array element from Array and override query language', function() {
        let array = i18n.api('en_US').t('main.list');
        expect(i18n.api('en_US').t(array, '2.value', 'fr_FR')).to.equal('Je suis en bas');
      });
      it('should interpolate', function() {
        expect(i18n.api('fr_FR').t('main.welcome', {name: 'George Boole'})).to.equal('Bienvenue George Boole');
      });
      it('should override query language', function() {
        expect(i18n.api('en_US').t('main.hello.world', 'fr_FR')).to.equal('Bonjour le monde');
      });
      it('should interpolate and override query language', function() {
        expect(i18n.api('en_US').t('main.welcome', {name: 'George Boole'}, 'fr_FR')).to.equal('Bienvenue George Boole');
      });
      it('should access array element from Array, interpolate and override query language', function() {
        let array = i18n.api('en_US').t('main.list');
        expect(i18n.api('en_US').t(array, '3.value', {content: 'contenu'}, 'fr_FR')).to.equal('Je peux changer mon contenu');
      });
    });
  });

  describe('#getLocale', function() {
    it('should return the english locale', function() {
      expect(i18n.api('en_US').getLocale()).to.be.equal('en_US');
    });
    it('should return the french locale', function() {
      expect(i18n.api('fr_FR').getLocale()).to.be.equal('fr_FR');
    });
    it('should return the default locale', function() {
      expect(i18n.api().getLocale()).to.be.equal('en_US');
    });
  });

  describe('#getLanguage', function() {
    it('should return the english locale', function() {
      expect(i18n.api('en_US').getLanguage()).to.be.equal('en');
    });
    it('should return the french locale', function() {
      expect(i18n.api('fr_FR').getLanguage()).to.be.equal('fr');
    });
    it('should return the default language', function() {
      expect(i18n.api().getLanguage()).to.be.equal('en');
    });
  });

  describe('#getLocales', function() {
    it('should return the locales', function() {
      expect(i18n.api('en_US').getLocales()).to.deep.equal(availableLocales);
    });
  });
  describe('#getLanguages', function() {
    it('should return the languages', function() {
      expect(i18n.api('en_US').getLanguages()).to.deep.equal(['en', 'fr']);
    });
  });

});