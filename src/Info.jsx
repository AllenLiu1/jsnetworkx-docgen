"use strict";

var React = require('react/addons');
var Router = require('react-router');
var Link = Router.Link;
var ActiveState = Router.ActiveState;

var cx = React.addons.classSet;
var capitalize = require('./capitalize');
var doccache = require('./doccache');
var kramed = require('./kramed');
var _ = require('lodash');

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
      info = <MethodInfo
        params={this.props.params}
        name={symbol}
        data={symbolData}
      />;
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
    var params = this.props.params.map(param => {
      var type = param.typeAsHTML ?
        <span dangerouslySetInnerHTML={
          {__html: param.typeAsHTML}
        } className="param-type"/> :
        null;

        return (
          <li key={param.name}>
            <span className="param-name">
              <code>
                {param.name}
              </code>
            </span>
            {type ? ': ' : ''}{type}
            <Description className="param-descr" text={param.description} />
          </li>
        );
    });
    return (
      <div>
        <h4>Parameters</h4>
        <ul>{params}</ul>
      </div>
    );
  }
});

var Returns = React.createClass({
  render: function() {
    var data = this.props.data;
    var type = data.typeAsHTML ?
      <span dangerouslySetInnerHTML={
        {__html: data.typeAsHTML}
      } className="param-type"/> :
      null;

    return (
      <div className="returns">
        <h4>Returns: {type}</h4>
        <Description className="param-descr" text={data.description} />
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

    // Return type
    var returnType;
    if (!data.aliasFor) {
      returnType =
        <code
          dangerouslySetInnerHTML={
            {__html: data.returns ? data.returns.typeAsHTML : 'void'}
          }
        />;
    }

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
          {returnType ? (isProperty ? 'Type:' : 'Returns:') : ''} {returnType}
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
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    name: React.PropTypes.string,
    data: React.PropTypes.object
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    if (this.props.name !== nextProps.name) {
      return true;
    }

    if (this.props.params.subsymbol !== nextProps.params.subsymbol) {
      this._scrollIntoView(nextProps.params.subsymbol);
    }
    return false;
  },

  componentDidMount: function() {
    this._scrollIntoView(this.props.params.subsymbol);
  },

  _scrollIntoView: function(subsymbol) {
    if (subsymbol) {
      setTimeout(() => {
        if (this.isMounted()) {
          var node = React.findDOMNode(this.refs[subsymbol]);
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
      <div key={property.name} className="class-method">
        <div className={classes}>
          <a
            className="anchor"
            name={property.name}
            id={property.name}
            ref={property.name}
          />
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
    var content = null;
    if (method.aliasFor) {
      content =
        <div>
          {'Alias for '}
          <Link
            to="subsymbol"
            params={_.assign(
              {},
              this.props.params,
              {subsymbol:  method.aliasFor}
            )}>
            {method.aliasFor}
          </Link>
        </div>;
    } else {
      content =
        <div>
          {method.params.length > 0 ?
            <Parameters params={method.params} /> :
            null
          }
          <Description
            className="symbol-description"
            text={method.description}
          />
        </div>;
    }

    return (
      <div key={method.name} className="class-method">
        <div className={classes}>
          <a
            className="anchor"
            name={method.name}
            id={method.name}
            ref={method.name} />
          <div className="panel-heading">
            <div className="panel-title">
              <Signature
                data={method}
                href={this.context.router.makeHref(
                  'subsymbol',
                  _.assign({}, this.props.params, {subsymbol: method.name})
                )}
              />
            </div>
          </div>
          <div className="panel-body">{content}</div>
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
    var aliases = data.aliases;
    var aliasInfo = null;
    if (data.aliasFor) {
      aliasInfo =
        <div className="aliasInfo">
          <code>{this.props.name}</code> is an <strong>alias</strong> for:
        </div>;
      data = doccache.get(this.props.params.version)[data.aliasFor];
    }

    var hasParams = data.params && data.params.length > 0;
    var hasReturns = data.returns && data.returns.description;
    var info;
    if (hasParams || hasReturns) {
      info =
        <div className="symbol-parameters">
          {hasParams ? <Parameters params={data.params} /> : null}
          {hasReturns ? <Returns data={data.returns} /> : null}
        </div>;
    }

    return (
      <div style={{marginTop: 20}}>
        {aliasInfo}
        <Signature data={data} />
        {info}
        <Description
          className="symbol-description"
          text={data.description}
        />
        <Aliases aliases={aliases} />
      </div>
    );
  }
});

module.exports = Info;
