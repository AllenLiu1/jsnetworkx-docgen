"use strict";
/*jshint ignore:start*/
var Promise = require('promise');
/*jshint ignore:end*/

var docblockParser = require('docblock-parser');
var fs = require('fs');
var globby = require('globby');
var catharsis = require('catharsis');
var recast = require('recast');
var types = recast.types;
var acorn = require('acorn-babel');
var _ = require('lodash');

types.Type.def('ImportBatchSpecifier')
  .bases('ImportNamespaceSpecifier')
  .finalize();

types.Type.def('RestElement')
  .bases('Pattern')
  .field('argument', types.Type.def('Pattern'))
  .finalize();

types.Type.def('AssignmentPattern')
  .bases('Pattern')
  .field('left', types.Type.def('Pattern'))
  .field('right', types.Type.def('Expression'))
  .finalize();

var parseWrapper = {
  parse: function(source, options) {
    var comments = [];
    var ast = acorn.parse(source, {
      ecmaVersion: 7,
      locations: options.loc,
      ranges: options.range,
      onComment: comments
    });
    ast.comments = comments;
    // convert range
    var nodes = [ast];
    var node;
    while (node = nodes.shift()) {
      if ('start' in node) {
        node.range = [node.start, node.end];
        delete node.start;
        delete node.end;
      }
      if (typeof node === 'object') {
        for (var prop in node) {
          if (prop !== 'loc' && typeof node[prop] === 'object') {
            nodes.push(node[prop]);
          }
        }
      }
    }
    return ast;
  }
};

/**
 * This function finds all functions exposed by `obj`. The same function could
 * be exposed in multiple levels. We make the assumption that functions with the
 * same name refer to the same function.
 *
 * @param {Object} obj
 * @return {Object}
 */
function extractPublicAPI(obj) {
  var result = Object.create(null);
  var nested = [];
  Object.keys(obj).forEach(function(name) {
    switch (typeof obj[name]) {
      case 'function':
        result[name] = {aliases: [name]};
        break;
      case 'object':
        nested.push(name);
        break;
    }
  });

  nested.forEach(function(name) {
    var api = extractPublicAPI(obj[name]);
    Object.keys(api).forEach(function(innerName) {
      if (innerName in result) {
        // merge aliases
        result[innerName] = {
          name: innerName,
          aliases: result[innerName].aliases.concat(
            api[innerName].aliases.map(function(x) { return name + '.' + x; })
          )
        };
      }
      else {
        result[innerName] = api[innerName];
      }
    });
  });

  return result;
}

function parseParamValue(value) {
  var valuePattern = /\s*\{(.*)}(?:\s+([^\s]+)(?:\s+([^]+))?)?$/;
  var match = value.match(valuePattern);
  if (match) {
    var type = catharsis.parse(match[1]);
    return {
      name: match[2],
      type: type,
      typeAsHTML: catharsis.stringify(type, {htmlSafe: true, restringify: true}),
      descr: match[3]
    };
  }
  return null;
}

/**
 * Processes a file to find classes and functions exposed in the api, extracts
 * additional information from docblocks and surrounding code.
 */
function processFile(src, api) {
  var ast = recast.parse(src, {esprima: parseWrapper});

  function getParam(param) {
    switch (param.type) {
      case 'Identifier':
        return {name: param.name};
      case 'AssignmentPattern':
        return {
          name: getParam(param.left).name,
          defaultValue: recast.print(param.right).code,
        };
    }
    return {};
  }
  types.visit(ast, {
    getDocblock: function(comments) {
      if (comments) {
        comments = comments.filter(function(comment) {
          return comment.leading;
        });
        if (comments.length > 0) {
          try {
            return docblockParser.parse(comments[comments.length - 1].value);
          }
          catch(ex) {}
        }
      }
      return null;
    },

    parseFunction: function(path, comments, doc) {
      var node = path.node;
      if (node.id) {
        doc.name = node.id.name;
      }

      doc.params = node.params.map(getParam);
      if (node.rest) {
        doc.params.push({name: node.rest.name, rest: true});
      }

      var docblock = this.getDocblock(comments);
      if (docblock) {
        doc.description = docblock.text;
        doc.private = docblock.tags.private;
        var params = docblock.tags.param;
        if (params) {
          if (!Array.isArray(params)) {
            params = [params];
          }
          params = params.map(parseParamValue);
          doc.params = doc.params.map(function(param, i) {
            return _.assign(params[i], param);
          });
        }
        doc.returns = docblock.tags.return ?
          parseParamValue(docblock.tags.return) :
          undefined;
      }
      doc.async = !!node.async;
      if (doc.async) {
        var genName = 'gen' + doc.name[0].toUpperCase() + doc.name.substr(1);
        if (genName in api) {
          api[genName].syncName = doc.name;
          api[genName].async = true;
          api[genName].params = doc.params;
          doc.asyncName = genName;
          doc.async = false;
        }
      }
      return doc;
    },

    visitExportDeclaration: function(path) {
      var comments = path.node.comments;
      if (types.namedTypes.FunctionDeclaration.check(path.node.declaration)) {
        this.parseFunctionDeclaration(path.get('declaration'), comments);
      } else if (types.namedTypes.ClassDeclaration.check(path.node.declaration)) {
        this.parseClassDeclaration(path.get('declaration'), comments);
      }
      return false;
    },

    parseFunctionDeclaration: function(path, comments) {
      var functionName = path.node.id.name;
      if (functionName in api) {
        this.parseFunction(path, comments, api[functionName]);
      }
      return false;
    },

    parseClassDeclaration: function(path, comments) {
      var node = path.value;
      var className = node.id.name;
      if (className in api) {
        var doc = api[className];
        doc.isClass = true;
        var docblock = this.getDocblock(comments);
        if (docblock) {
          doc.description = docblock.text;
          doc.name = className;
          doc.extends = node.superClass && node.superClass.name;
        }
        doc.methods = [];
        doc.properties = [];
        doc.staticMethods = [];
        doc.staticProperties = [];
        types.visit(path, {
          getDocblock: this.getDocblock,
          parseFunction: this.parseFunction,
          visitMethodDefinition: function(path) {
            var node = path.node;
            var name = node.computed ?
              recast.print(node.key).code :
              node.key.name;
            var methodDoc = this.parseFunction(
              path.get('value'),
              path.node.comments,
              {name: name, computed: node.computed}
            );
            if (name === 'constructor') {
              doc.constructor = methodDoc;
              doc.constructor.name = className;
            }
            else if (!methodDoc.private) {
              var s = node.static;
              if (node.kind === 'get' || node.kind === 'set') {
                var target = s ? doc.staticProperties : doc.properties;
                var existingProp;
                target.some(function(prop) {
                  if (prop.name === name) {
                    existingProp = prop;
                    return true;
                  }
                });
                if (existingProp) {
                  existingProp.returns =
                    existingProp.returns || methodDoc.returns;
                  existingProp.readonly = !existingProp.returns;
                } else {
                  methodDoc.readonly = !methodDoc.returns;
                  target.push(methodDoc);
                }
              }
              else {
                (s ? doc.staticMethods : doc.methods).push(methodDoc);
              }
            }
            return false;
          }
        });
      }
      return false;
    },
  });
}

function extractDocs(patterns, root) {
  return new Promise(function(resolve, reject) {
    var api = extractPublicAPI(root);
    globby(patterns, function(err, paths) {
      if (err) {
        reject(err);
        return;
      }
      var processedFiles = 0;
      paths.forEach(function(path) {
        fs.readFile(path, function(err, src) {
          processedFiles += 1;
          if (err) {
            reject(err);
            return;
          }
          try {
            processFile(src, api);
          } catch(error) {
            console.error('Error while processing ' + path);
            throw error;
          }
          if (processedFiles === paths.length) {
            resolve(api);
          }
        });
      });
    });
  });
}

module.exports = extractDocs;
