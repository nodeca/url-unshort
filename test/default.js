
'use strict';


var assert = require('assert');


describe('Default', function () {
  var uu;

  before(function () {
    uu = require('../')();

    uu.add('example.org');
  });

  it('should process redirect', function (callback) {
    uu.request = function (options, callback) {
      callback(null, { statusCode: 301, headers: { location: 'https://github.com/0' } }, '');
    };

    uu.expand('http://example.org/foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/0');
      callback();
    });
  });

  it('should parse meta tags', function (callback) {
    uu.request = function (options, callback) {
      callback(null, { statusCode: 200, headers: { 'content-type': 'text/html' } },
        '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>');
    };

    uu.expand('http://example.org/bar', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/1');
      callback();
    });
  });

  it('should not process file if it\'s not html', function (callback) {
    uu.request = function (options, callback) {
      callback(null, { statusCode: 200, headers: { 'content-type': 'application/json' } },
        '<html><head><meta http-equiv="refresh" content="10; url=https://github.com/1 "></head><body></body></html>');
    };

    uu.expand('http://example.org/zzz', function (err, result) {
      assert.ifError(err);
      assert.equal(result, null);
      callback();
    });
  });

  it('should return nothing on 404', function (callback) {
    uu.request = function (options, callback) {
      callback(null, { statusCode: 404 }, '');
    };

    uu.expand('http://example.org/baz', function (err, result) {
      assert.ifError(err);
      assert.equal(result, null);
      callback();
    });
  });

  it('should return errors on unknown status codes', function (callback) {
    uu.request = function (options, callback) {
      callback(null, { statusCode: 503 }, '');
    };

    uu.expand('http://example.org/baz', function (err, result) {
      assert(err.message.match(/Remote server error/));
      callback();
    });
  });

});
