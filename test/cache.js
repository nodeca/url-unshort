
'use strict';


var assert = require('assert');


describe('Expand', function () {
  var uu;
  var fetchCount = 0;
  var cache = {};

  before(function () {
    uu = require('../')({
      cache: {
        get: function (key, callback) {
          callback(null, cache[key]);
        },
        set: function (key, value, callback) {
          cache[key] = value;
          callback();
        }
      }
    });

    uu.add('example.org', {
      fetch: function (url, options, callback) {
        fetchCount++;
        callback(null, 'http://foo.bar/');
      }
    });
  });

  it('should cache urls', function (done) {
    cache = {};

    uu.expand('http://example.org/foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://foo.bar/');

      uu.expand('http://example.org/foo', function (err, result) {
        assert.ifError(err);
        assert.equal(result, 'http://foo.bar/');
        assert.equal(fetchCount, 1);
        done();
      });
    });
  });

  it('should not cache invalid urls', function (done) {
    cache = {};

    uu.expand('http://invalid-url.com/foo', function (err, result) {
      assert.ifError(err);
      assert.strictEqual(result, null);
      assert.deepEqual(cache, {});
      done();
    });
  });


  it('should resolve disabled services from cache, if used before', function (done) {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' };

    uu.expand('http://old.service.com/123', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://redirected.to/');
      done();
    });
  });

  it('should forward hash to cached value', function (done) {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' };

    uu.expand('http://old.service.com/123#foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://redirected.to/#foo');
      done();
    });
  });

  it('should cache null result after first fetch', function (callback) {
    uu.add('example2.org', {
      fetch: function (url, options, callback) {
        callback(null, null);
      }
    });

    cache = {};

    uu.expand('http://example2.org/foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, null);
      assert.deepEqual(cache, { 'http://example2.org/foo': null });

      uu.expand('http://example2.org/foo', function (err, result) {
        assert(!err);
        assert.equal(result, null);

        callback();
      });
    });
  });

  it('should properly cache last null fetch in nested redirects', function (callback) {
    uu.add('example3.org', {
      fetch: function (url, options, callback) {
        callback(null, 'http://example4.org/test');
      }
    });

    uu.add('example4.org', {
      fetch: function (url, options, callback) {
        callback(null, null);
      }
    });

    cache = {};

    uu.expand('http://example3.org/foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://example4.org/test');
      assert.deepEqual(cache, { 'http://example3.org/foo': 'http://example4.org/test' });

      callback();
    });
  });
});
