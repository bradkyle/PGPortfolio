const check = require('check-types');

module.exports = (chai) => {

  const types = ['number', 'string', 'boolean', 'object', 'array', 'date', 'function'];

  types.forEach((type) => {
    chai.Assertion.addMethod(type, function() {
      this.assert(
        check[type](this._obj),
        `expected #{this} to be ${type}`,
        `expected #{this} not to be ${type}`
      );
    });
  });

};