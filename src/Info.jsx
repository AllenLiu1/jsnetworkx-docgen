"use strict";

var React = require('react/addons');
var Router = require('react-router');
var Link = Router.Link;
var ActiveState = Router.ActiveState;

var cx = React.addons.classSet;
var hljs = require('highlight.js');
var kramed = require('kramed');
var _ = require('lodash');

kramed.setOptions({
  highlight: function (code) {
    return hljs.highlight('javascript', code).value;
  }
});

var SideIndex = React.createClass({
  mixins: [ActiveState],

  render: function() {
    var links = Object.keys(this.props.docs).sort().map(
      k =>
        <li key={k}>
          <Link
            to="symbol"
            params={_.assign(
              {},
              this.getActiveParams(),
              {symbol:  k}
            )}>
            {k}
          </Link>
        </li>
    );
    return (
      <div className="side-index">
        <Link to="version" params={this.getActiveParams()}>&larr; Index</Link>
        <h3>{this.props.name}</h3>
        <ul>{links}</ul>
        {this.props.children}
      </div>
    );
  }
});

var ClassIndex = React.createClass({
  render: function() {
    var methods = this.props.cls.methods.slice();
    var links = methods
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(
        method =>
          <li key={method.name}>
            <a href={'#'+method.name}>{method.name}</a>
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
    var category = this.props.params.category;
    var docs = this.props.docs;
    var symbol = this.props.params.symbol;
    var symbolData = docs[category][symbol];
    var info;
    var childIndex;

    if (!symbolData) {
      info =
        <div className="alert alert-danger" role="alert">
          <strong>:(</strong> "{symbol}" doesn't seem to exist.
        </div>;
    }
    else if(symbolData.isClass) {
      info = <ClassInfo name={symbol} data={symbolData} />;
      childIndex = <ClassIndex cls={symbolData} />;
    }
    else {
      if (symbolData.syncName) {
        symbolData = docs[category][symbolData.syncName];
      }
      info = <MethodInfo name={symbol} data={symbolData} />;
    }


    return (
      <div className="row">
        <div className="col-md-5 col-lg-4 hidden-sm">
          <SideIndex name={category} docs={docs[category]}>
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
          <p className="param-descr">{param.descr}</p>
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
    try {
      text = kramed(text);
    }
    catch(ex) {}

    if (!text) {
      return null;
    }

    return (
      <div
        className="symbol-description"
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
    if (async) {
      returnType = <code>Promise&lt;{returnType}&gt;</code>;
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

  _renderProperty: function(property) {
    var classes = cx({
      panel: true,
      'panel-default': true,
      'class-method': true,
      withDescription: !!property.description
    });

    return (
      <div key={property.name} className={classes}>
        <a className="anchor" name={property.name} id={property.name} />
        <div className="panel-heading">
          <div className="panel-title">
            <Signature data={property} isproperty={true} />
          </div>
        </div>
        <div className="panel-body">
          <Description text={property.description} />
        </div>
      </div>
    );
  },

  _renderMethod: function(method) {
    var classes = cx({
      panel: true,
      'panel-default': true,
      'class-method': true,
      withDescription: !!method.description
    });

    return (
      <div key={method.name} className={classes}>
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
          <Description text={method.description} />
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
    return (
      <div className="section">
        <h3>Methods</h3>
        {this.props.data.methods.map(this._renderMethod)}
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
        <Description text={data.description} />
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
        <Description text={data.description} />
        <Aliases aliases={data.aliases} />
      </div>
    );
  }
});

module.exports = Info;
