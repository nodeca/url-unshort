
'use strict';


var assert   = require('assert');
var async    = require('async');
var fs       = require('fs');
var YAML     = require('js-yaml');
var path     = require('path');
var punycode = require('punycode');
var request  = require('request');
var URL      = require('url');
var urls     = YAML.safeLoad(fs.readFileSync(path.join(__dirname, 'services.yml'), 'utf8'));
var domains  = YAML.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'domains.yml'), 'utf8'));
var uu       = require('../')();


var checkAll = (process.env.LINKS_CHECK === 'all');


// get 2nd level domain, e.g. "foo.example.org" -> "example.org"
function truncateDomain(str) {
  return str.split('.').slice(-2).join('.');
}


describe('Services', function () {
  it('all services should be tested', function () {

    var expected = [];
    var actual = [];

    domains.forEach(function (d) {
      if (typeof d === 'string') {
        expected.push(d);
      } else {
        expected = expected.concat(Object.keys(d));
      }
    });

    Object.keys(urls).forEach(function (url) {
      var u = URL.parse(url);

      actual.push(u.host);
    });

    assert.deepEqual(expected.map(truncateDomain).map(punycode.toUnicode).sort(),
                     actual.map(truncateDomain).map(punycode.toUnicode).sort());
  });

  describe('ping services', function () {
    var links = Object.keys(urls);

    if (!checkAll) { links = links.slice(0, 1); }

    links.forEach(function (link) {

      it(link, function (done) {
        uu.expand(link, function (err, result) {
          if (err) {
            done(err);
            return;
          }

          assert.strictEqual(result, urls[link]);
          done();
        });
      });
    });
  });

});
