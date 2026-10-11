// CloudFront Function (runtime 2.0) source that answers every request with a redirect to `host`, keeping the path
// and query string. A 302 on purpose: browsers cache a 301 for good, which would be hard to undo if the bare
// domain later gets its own site. Switch to 301 when the move is permanent.
exports.redirectCode = (host) => `function handler(event) {
  var request = event.request;
  var query = [];
  var qs = request.querystring || {};
  Object.keys(qs).forEach(function (key) {
    var entry = qs[key];
    var values = entry.multiValue ? entry.multiValue.map(function (v) { return v.value; }) : [entry.value];
    values.forEach(function (value) {
      query.push(value === undefined || value === '' ? key : key + '=' + value);
    });
  });
  var location = 'https://${host}' + request.uri + (query.length ? '?' + query.join('&') : '');
  return { statusCode: 302, statusDescription: 'Found', headers: { location: { value: location } } };
}`;
