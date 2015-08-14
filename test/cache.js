
'use strict';


var assert = require('assert');


describe('Expand', function () {
  var uu;
  var calls = 0;

  before(function () {
    var data = {};

    uu = require('../')({
      cache: {
        get: function (key, callback) {
          callback(null, data[key]);
        },
        set: function (key, value, callback) {
          data[key] = value;
          callback();
        }
      }
    });

    uu.add('example.org', {
      fetch: function (url, options, callback) {
        calls++;
        callback(null, 'http://foo.bar/');
      }
    });
  });

  it('should cache urls', function (callback) {
    uu.expand('http://example.org/foo', function (err, result) {
      assert(!err);
      assert.equal(result, 'http://foo.bar/');

      uu.expand('http://example.org/foo', function (err, result) {
        assert(!err);
        assert.equal(result, 'http://foo.bar/');
        assert.equal(calls, 1);
        callback();
      });
    });
  });
});
