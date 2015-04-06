'use strict';

var React = require('react/addons');
var Router = require('react-router');
var Link = Router.Link;
var _ = require('lodash');
var capitalize = require('./capitalize');
var doccache = require('./doccache');

var Header = React.createClass({
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.value !== this.props.value ||
      nextProps.level !== this.props.level;
  },

  render: function() {
    return React.createElement('h' + this.props.level, null, this.props.value);
  }
});

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
    var subsections = subheaders.sort().map(
      header => docs[header].categories ?
        (<div>
          <Link
            to="symbol"
            params={_.assign({symbol: header}, this.props.params)}>
            {header}
          </Link>
        </div>) :
        (<Section
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
