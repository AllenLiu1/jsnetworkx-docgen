'use strict';

var versions = {};
var categorized = {};

function categorize(version, docs) {
  if (!(version in categorized)) {
    var categories = {};
    for (var symbolName in docs) {
      var doc = docs[symbolName];
      var category;
      if (doc.categories.length === 0) {
        category = categories.misc || (categories.misc = {});
      } else {
        var category = doc.categories.reduce(
          (obj, name) => (obj[name] || (obj[name] = {})),
          categories
        );
      }
      category[symbolName] = doc;
    }
    categorized[version] = categories;
  }
  return categorized[version];
}

function get(version) {
  return versions[version];
}

function set(version, docs) {
  versions[version] = docs;
}

function getCategorized(version) {
  return categorize(version, versions[version]);
}

exports.get = get;
exports.set = set;
exports.getCategorized = getCategorized;
