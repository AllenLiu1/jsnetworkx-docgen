"use strict";

var React = require('react/addons');
var Router = require('react-router');
var Link = Router.Link;
var ActiveState = Router.ActiveState;

var cx = React.addons.classSet;
var capitalize = require('./capitalize');
var doccache = require('./doccache');
var hljs = require('highlight.js');
var katex = require('katex');
var kramed = require('kramed');
var _ = require('lodash');

var node = document.createElement('span');

var renderer = (function() {
  var renderer = new kramed.Renderer();
  var inlinecode = renderer.codespan;
  var blockcode = renderer.code;

  renderer.code = function(code, lang) {
    if (lang === 'math') {
      node.innerHTML = code;
      code = node.innerText;
      return katex.renderToString(code, { displayMode: true });
    }
    return blockcode.call(renderer, code, lang);
  };

  renderer.codespan = function(code) {
    if (/^\$.*\$$/.test(code)) {
      node.innerHTML = code;
      code = node.innerText;
      return katex.renderToString(code.substring(1, code.length - 1));
    }
    return inlinecode.call(renderer, code);
  };

  return renderer;
}());

kramed.setOptions({
  highlight: function (code) {
    return hljs.highlight('javascript', code).value;
  },
  renderer: renderer
});

function getSourroundingDocs(version, doc) {
  var docs = doccache.getCategorized(version);
  return doc.categories.reduce((docs, category) => {
    return docs[category];
  }, docs);
}

var SideIndex = React.createClass({
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.params.symbol !== this.props.params.symbol;
  },

  render: function() {
    var links = Object.keys(this.props.docs).sort().map(
      k =>
        <li key={k}>
          <Link
            to="symbol"
            params={_.assign(
              {},
              this.props.params,
              {symbol:  k}
            )}>
            {k}
          </Link>
        </li>
    );
    var header = this.props.name.map(
      name => <h3 key={name}>{capitalize(name)}</h3>
    );
    return (
      <div className="side-index">
        <Link to="version" params={this.props.params}>&lt; Index</Link>
        {header}
        <ul>{links}</ul>
        {this.props.children}
      </div>
    );
  }
});

var ClassIndex = React.createClass({
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.params.symbol !== this.props.params.symbol;
  },

  render: function() {
    var methods = this.props.cls.methods.slice();
    if (this.props.cls.extends) {
      var superCls =
        doccache.get(this.props.params.version)[this.props.cls.extends];
      methods = _.uniq(methods.concat(superCls.methods), 'name');
    }
    var links = methods
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(
        method =>
          <li key={method.name}>
            <Link
              to="subsymbol"
              params={_.assign(
                {},
                this.props.params,
                {subsymbol:  method.name}
              )}>
              {method.name}
            </Link>
          </li>
      );
    return (
      <div>
        <h4>{this.props.cls.name}</h4>
        <ul>{links}</ul>
      </div>
    );
  }
});

var Info = React.createClass({
  render: function() {
    var docs = doccache.get(this.props.params.version);
    var symbol = this.props.params.symbol;
    var symbolData = docs[symbol];
    var category = symbolData.categories[0];
    var info;
    var childIndex;

    if (!symbolData) {
      info =
        <div className="alert alert-danger" role="alert">
          <strong>:(</strong> "{symbol}" doesn't seem to exist.
        </div>;
    }
    else if(symbolData.isClass) {
      info =
        <ClassInfo
          params={this.props.params}
          name={symbol}
          data={symbolData}
        />;
      childIndex = <ClassIndex params={this.props.params} cls={symbolData} />;
    }
    else {
      if (symbolData.syncName) {
        symbolData = docs[symbolData.syncName];
      }
      info = <MethodInfo name={symbol} data={symbolData} />;
    }


    return (
      <div className="row">
        <div className="col-md-5 col-lg-4 hidden-sm hidden-xs">
          <SideIndex
            params={this.props.params}
            name={symbolData.categories}
            docs={getSourroundingDocs(
              this.props.params.version,
              symbolData
            )}>
            {childIndex}
          </SideIndex>
        </div>
        <div className="col-md-7 col-lg-8">
          {info}
        </div>
      </div>
    );
  }
});

var Parameters = React.createClass({
  render: function() {
    var params = this.props.params.map(
      param =>
        <li key={param.name}>
          <span className="param-name">
            <code>
              {param.name}
            </code>
          </span>
          {': '}
          <span dangerouslySetInnerHTML={
            {__html: param.typeAsHTML}
          } className="param-type"/>
          <div className="param-descr">{param.summary}</div>
          <Description className="param-descr" text={param.description} />
        </li>
    );
    return (
      <div className="symbol-parameters">
        <h4>Parameters</h4>
        <ul>{params}</ul>
      </div>
    );
  }
});

var Description = React.createClass({
  render: function() {
    var text = this.props.text;
    if (!text) {
      return null;
    }

    try {
      text =  kramed(text);
    } catch(ex) {}


    return (
      <div
        {...this.props}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }
});

var Aliases = React.createClass({
  render: function() {
    var aliases = this.props.aliases.map(
      a => <li key={a}><code>{a}</code></li>
    );

    return (
      <div className="well well-sm">
        {'Available as:'}
        <ul>{aliases}</ul>
      </div>
    );
  }
});

var Signature = React.createClass({

  _renderInternal: function(async) {
    var data = this.props.data;
    var name = async ? data.asyncName : data.name;
    if (data.computed) {
      name = '[' + name + ']';
    }
    var params = data.params ?
      data.params.map(
        param => param.name + ('defaultValue' in param ? '=' + param.defaultValue : '')
      ).join(', ') :

      null;
    var isProperty = this.props.isproperty;
    var signature = <code>{name}{!isProperty ? '(' + params + ')' : ''}</code>;
    if (this.props.href) {
      signature = <a href={this.props.href}>{signature}</a>;
    }

    var returnType =
      <code
        dangerouslySetInnerHTML={
          {__html: data.returns ? data.returns.typeAsHTML : 'void'}
        }
      />;
    if (async && data.returns) {
      returnType = <code
        dangerouslySetInnerHTML={{
          __html: 'Promise&lt;' +
            data.returns.typeAsHTML.replace(/^Iterator/, 'Array') +
            '&gt;'
        }} />;
    }

    return (
      <div className="clearfix symbol-title">
        <h4 className="pull-left">{signature}</h4>
        <span className="returnType pull-right">
          {isProperty ? 'Type:' : 'Returns:'} {returnType}
        </span>
      </div>
    );
  },

  render: function() {
    var async = null;
    if (this.props.data.asyncName) {
      async = this._renderInternal(true);
    }

    return (
      <div>
        {this._renderInternal(false)}
        {async}
      </div>
    );
  }
});

var ClassInfo = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
    data: React.PropTypes.object
  },

  componentDidMount: function() {
    this._scrollIntoView();
  },

  componentDidUpdate: function(prevProps) {
    if (this.props.params.subsymbol !== prevProps.params.subsymbol) {
      this._scrollIntoView();
    }
  },

  _scrollIntoView: function() {
    if (this.props.params.subsymbol) {
      setTimeout(() => {
        if (this.isMounted()) {
          var node = React.findDOMNode(this.refs[this.props.params.subsymbol]);
          if (node) {
            node.scrollIntoView();
          }
        }
      }, 0);
    }
  },

  _renderProperty: function(property) {
    var classes = cx({
      panel: true,
      'panel-default': true,
      withDescription: !!property.description
    });

    return (
      <div key={property.name} ref={property.name} className="class-method">
        <div className={classes}>
          <a className="anchor" name={property.name} id={property.name} />
          <div className="panel-heading">
            <div className="panel-title">
              <Signature data={property} isproperty={true} />
            </div>
          </div>
          <div className="panel-body">
            <Description
              className="symbol-description"
              text={property.description}
            />
          </div>
        </div>
      </div>
    );
  },

  _renderMethod: function(method) {
    var classes = cx({
      panel: true,
      'panel-default': true,
      withDescription: !!method.description
    });

    return (
      <div key={method.name} ref={method.name} className="class-method">
        <div className={classes}>
          <a className="anchor" name={method.name} id={method.name} />
          <div className="panel-heading">
            <div className="panel-title">
              <Signature data={method} href={'#' + method.name}/>
            </div>
          </div>
          <div className="panel-body">
            {method.params.length > 0 ?
              <Parameters params={method.params} /> :
              null
            }
            <Description
              className="symbol-description"
              text={method.description}
            />
          </div>
        </div>
      </div>
    );
  },

  _renderConstructor: function() {
    return (
      <div className="section">
        <h3>Constructor</h3>
        {this._renderMethod(this.props.data.constructor)}
      </div>
    );
  },

  _renderProperties: function() {
    return (
      <div className="section">
        <h3>Properties</h3>
        {this.props.data.properties.map(this._renderProperty)}
      </div>
    );
  },

  _renderMethods: function() {
    var methods = this.props.data.methods;
    if (this.props.data.extends) {
      var superCls =
        doccache.get(this.props.params.version)[this.props.data.extends];
      methods = _.uniq(methods.concat(superCls.methods), 'name');
    }

    return (
      <div className="section">
        <h3>Methods</h3>
        {methods.map(this._renderMethod)}
      </div>
    );
  },

  render: function() {
    var data = this.props.data;
    var name = this.props.name;

    var signature = <code>{name}</code>;
    if (data.extends) {
      signature =
        <span>
          {signature}{' '}
          <small>extends <code>{data.extends}</code></small>
        </span>;
    }
    return (
      <div>
        <div className="clearfix symbol-title">
          <h2 className="pull-left">{signature}</h2>
        </div>
        <Description
          className="symbol-description"
          text={data.description}
        />
        <hr />
        {this._renderConstructor()}
        {this._renderProperties()}
        {this._renderMethods()}
        <Aliases aliases={data.aliases} />
      </div>
    );
  }
});

var MethodInfo = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
    data: React.PropTypes.object
  },

  render: function() {
    var data = this.props.data;

    return (
      <div style={{marginTop: 20}}>
        <Signature data={data} />
        {data.params && data.params.length > 0 ? <Parameters params={data.params} /> : null}
        <Description
          className="symbol-description"
          text={data.description}
        />
        <Aliases aliases={data.aliases} />
      </div>
    );
  }
});

module.exports = Info;
