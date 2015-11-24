
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

  it('should cache urls', function (callback) {
    cache = {};

    uu.expand('http://example.org/foo', function (err, result) {
      assert(!err);
      assert.equal(result, 'http://foo.bar/');

      uu.expand('http://example.org/foo', function (err, result) {
        assert(!err);
        assert.equal(result, 'http://foo.bar/');
        assert.equal(fetchCount, 1);
        callback();
      });
    });
  });

  it('should not cache invalid urls', function (callback) {
    cache = {};

    uu.expand('http://invalid-url.com/foo', function (err, result) {
      assert(!err);
      assert(!result);
      assert.deepEqual(cache, {});
      callback();
    });
  });
});
