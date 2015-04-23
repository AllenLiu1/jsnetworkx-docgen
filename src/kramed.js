var kramed = require('kramed');
var katex = require('katex');

var node = document.createElement('span');

var renderer = (function() {
  var renderer = new kramed.Renderer();
  var inlinecode = renderer.codespan;
  var blockcode = renderer.code;

  renderer.code = function(code, lang) {
    if (lang === 'math') {
      node.innerHTML = code;
      code = node.innerText || node.textContent;
      return katex.renderToString(code, { displayMode: true });
    }
    return blockcode.call(renderer, code, lang);
  };

  renderer.codespan = function(code) {
    if (/^\$.*\$$/.test(code)) {
      node.innerHTML = code;
      code = node.innerText || node.textContent;
      return katex.renderToString(code.substring(1, code.length - 1));
    }
    return inlinecode.call(renderer, code);
  };

  return renderer;
}());

kramed.setOptions({
  highlight: function (code) {
    return global.hljs.highlight('javascript', code).value;
  },
  renderer: renderer
});

module.exports = kramed;
