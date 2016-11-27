
'use strict';


const assert = require('assert');


describe('Cache', function () {
  let uu;
  let fetchCount = 0;
  let cache = {};

  before(function () {
    uu = require('../')({
      cache: {
        get: key => Promise.resolve(cache[key]),
        set: (key, value) => {
          cache[key] = value;
          return Promise.resolve(true);
        }
      }
    });

    uu.add('example.org', {
      fetch() {
        fetchCount++;
        return Promise.resolve('http://foo.bar/');
      }
    });
  });


  it('should cache urls', function () {
    cache = {};

    return uu.expand('http://example.org/foo')
      .then(result => {
        assert.equal(result, 'http://foo.bar/');
        return uu.expand('http://example.org/foo');
      })
      .then(result => {
        assert.equal(result, 'http://foo.bar/');
        assert.equal(fetchCount, 1);
      });
  });


  it('should not cache invalid urls', function () {
    cache = {};

    return uu.expand('http://invalid-url.com/foo').then(result => {
      assert.strictEqual(result, null);
      assert.deepEqual(cache, {});
    });
  });


  it('should resolve disabled services from cache, if used before', function () {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' };

    return uu.expand('http://old.service.com/123').then(result => {
      assert.equal(result, 'http://redirected.to/');
    });
  });

  it('should forward hash to cached value', function () {
    cache = { 'http://old.service.com/123': 'http://redirected.to/' };

    uu.expand('http://old.service.com/123#foo', function (err, result) {
      assert.ifError(err);
      assert.equal(result, 'http://redirected.to/#foo');
    });
  });


  it('should cache null result after first fetch', function () {
    uu.add('example2.org', {
      fetch() { return Promise.resolve(null); }
    });

    cache = {};

    return uu.expand('http://example2.org/foo')
      .then(result => {
        assert.equal(result, null);
        assert.deepEqual(cache, { 'http://example2.org/foo': null });

        return uu.expand('http://example2.org/foo')
          .then(result => assert.equal(result, null));
      });
  });

  it('should properly cache last null fetch in nested redirects', function () {
    uu.add('example3.org', {
      fetch() {
        return Promise.resolve('http://example4.org/test');
      }
    });

    uu.add('example4.org', {
      fetch() { return Promise.resolve(null); }
    });

    cache = {};

    return uu.expand('http://example3.org/foo').then(result => {
      assert.equal(result, 'http://example4.org/test');
      assert.deepEqual(cache, { 'http://example3.org/foo': 'http://example4.org/test' });
    });
  });
});
