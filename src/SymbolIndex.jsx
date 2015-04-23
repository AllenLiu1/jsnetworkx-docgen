'use strict';

var React = require('react/addons');
var Router = require('react-router');
var Link = Router.Link;
var _ = require('lodash');
var capitalize = require('./capitalize');
var doccache = require('./doccache');
var kramed = require('./kramed');

var Header = React.createClass({
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.value !== this.props.value ||
      nextProps.level !== this.props.level;
  },

  render: function() {
    return React.createElement('h' + this.props.level, null, this.props.value);
  }
});

var Summary = React.createClass({
  render: function() {
    var {description} = this.props.docs;
    var summary = '';
    if (description) {
      var match = description.match(/^([^]*?\.)\s*\n/);
      if (match && match[1]) {
        summary = kramed(match[1]);
      }
    }
    return <div className="summary" dangerouslySetInnerHTML={
      {__html: summary}
    } />;
  }
});

function ungen(x) {
  return x.replace(/^gen/, '');
}

var Section = React.createClass({
  render() {
    var level = Math.min(this.props.level, 6);
    var docs = this.props.docs;
    var header = this.props.header;
    if (header) {
      header = capitalize(header);
    }
    var subheaders = Object.keys(docs);
    var hasSubsections = subheaders.some(x => !docs[x].categories);
    var subsections = subheaders
      .filter(function(h) {
        return !docs[h].syncName;
      })
      .sort(function(a, b) {
        if (docs[a].categories && !docs[b].categories) {
          return -1;
        }
        return a.localeCompare(b);
      })
      .map(
        header => docs[header].categories ?
          (<div className="link" key={header}>
            <Link
              to="symbol"
              params={_.assign({symbol: header}, this.props.params)}>
              {header}{docs[header].asyncName ? ' / ' + docs[header].asyncName : null}
            </Link>
            <Summary docs={docs[header]} />
          </div>) :
          (<Section key={header}
             {...this.props}
             header={header}
             docs={docs[header]}
             level={level+1}
           />)
      );

    var className = [
      'section',
      hasSubsections ? 'hasSubsections' : ''
    ].join(' ');

    return (
      <div className={className}>
        <Header level={level} value={header} />
        {subsections}
      </div>
    );
  }
});

var SymbolIndex = React.createClass({

  getInitialState: function() {
    return {docs: doccache.getCategorized(this.props.params.version)};
  },


  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.params.version !== this.props.params.version;
  },

  componentWillReceiveProps: function(nextProps) {
    var version = nextProps.params.version;
    if (version !== this.props.params.version) {
      this.setState({docs: doccache.getCategorized(version)});
    }
  },

  render: function() {
    return (
      <div className={'main-section'}>
        <Section params={this.props.params} docs={this.state.docs} level={1} />
      </div>
    );
  }
});

module.exports = SymbolIndex;
