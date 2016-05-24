
'use strict';


var assert = require('assert');


var urls = {
  'http://example.org/regular': 'https://github.com/',

  // loop1 -> loop2 -> loop3 -> loop4 -> github
  'http://example.org/loop1':   'http://example.org/loop2',
  'http://example.org/loop2':   'http://example.org/loop3',
  'http://example.org/loop3':   'http://example.org/loop4',
  'http://example.org/loop4':   'https://github.com/',

  // self-referenced
  'http://example.org/cycle':   'http://example.org/cycle',

  // control characters in the output
  'http://example.org/control': 'https://github.com/<foo\rbar baz>',

  // invalid protocol
  'http://example.org/file':    'file:///etc/passwd',

  // result has anchor in it
  'http://example.org/hashy':   'https://github.com/foo#bar',

  // relative urls
  'http://example.org/rel1':    '//github.com/foo',
  'http://example.org/rel2':    '/foo',

  // l1 -> l2 -> null
  'http://example.org/l1':      'http://example.org/l2',
  'http://example.org/l2':      null
};


describe('Expand', function () {
  var uu;

  before(function () {
    uu = require('../')();

    uu.add('example.org', {
      fetch: function (url, options, callback) {
        callback(null, urls[url.replace(/^https/, 'http')]);
      }
    });
  });

  it('should expand regular url', function (callback) {
    uu.expand('http://example.org/regular', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/');
      callback();
    });
  });

  it('should expand regular url via Promise', function () {
    return uu.expand('http://example.org/regular').then(function (result) {
      assert.equal(result, 'https://github.com/');
    });
  });

  it('should expand url up to 3 levels', function (callback) {
    uu.expand('http://example.org/loop2', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/');
      callback();
    });
  });

  it('should fail on url nested more than 3 levels', function (callback) {
    uu.expand('http://example.org/loop1', function (err) {
      assert.equal(err.message, 'Too many redirects');
      callback();
    });
  });

  it('should fail on links redirecting to themselves', function (callback) {
    uu.expand('http://example.org/cycle', function (err) {
      assert.equal(err.message, 'Too many redirects');
      callback();
    });
  });

  it('should fail on bad protocols', function (callback) {
    uu.expand('http://example.org/file', function (err) {
      assert.equal(err.message, 'Redirected to an invalid location');
      callback();
    });
  });

  it('should not encode non-url characters', function (callback) {
    uu.expand('http://example.org/control', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/<foo\rbar baz>');
      callback();
    });
  });

  it('should preserve an anchor', function (callback) {
    uu.expand('http://example.org/regular#foobar', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/#foobar');
      callback();
    });
  });

  it('should respect destination anchor', function (callback) {
    uu.expand('http://example.org/hashy#quux', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/foo#bar');
      callback();
    });
  });

  it('should accept relative urls without protocol', function (callback) {
    uu.expand('//example.org/regular', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'https://github.com/');
      callback();
    });
  });

  it('should accept links to relative urls without protocol', function (callback) {
    uu.expand('http://example.org/rel1', function (err, result) {
      assert.ifError(err);
      assert.equal(result, '//github.com/foo');
      callback();
    });
  });

  it('should reject links to relative urls without host', function (callback) {
    uu.expand('http://example.org/rel2', function (err) {
      assert.equal(err.message, 'Redirected to an invalid location');
      callback();
    });
  });

  it('should properly expand url with last null fetch in nested redirects', function (callback) {
    uu.expand('http://example.org/l1', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://example.org/l2');
      callback();
    });
  });
});
