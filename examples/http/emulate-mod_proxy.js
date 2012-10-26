/*
  emulate-mod_proxy.js: Example emulating ProxyPass and ProxyPassReverse from mod_proxy.

  Copyright (c) 2010 Charlie Robbins, Mikeal Rogers, Fedor Indutny, & Marak Squires.

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var util = require('util'),
  colors = require('colors'),
  http = require('http'),
  url = require('url'),
  httpProxy = require('../../lib/node-http-proxy');


var proxyPort = 80,
  backendPort = 8000;

//
// Create target backend servers
//

var wrapInHtml = function (body) {
  return [
    '<html>',
    '<head></head>',
    '<body>',
    '\t' + body,
    '</body>',
    '</html>'
  ].join('\n');
};

http.createServer(function (req, res) {
  var reqInfo = {
    method: req.method,
    url: url.parse(req.url),
    headers: req.headers
  };

  util.puts(req.headers.host.green.bold.underline +
    ' received proxied request from '.blue +
    req.headers['x-forwarded-host'].yellow.underline  +
    ' with url '.blue +
    req.url.yellow
  );

  //
  // Emulate name based virtual hosting
  //
  if(!req.headers.host.match(/^backend[12]:8000$/i)) {
    util.puts(req.headers.host.red.bold.underline +
      ' cannot be handled by backend server, bailing out with `500`'.red.bold
    );
    res.writeHead(500,{'Content-type' : 'text/plain'});
    res.end('Internal server error');
    return;
  }

   var getRedirectUrl = function (testUrl) {
    var match = testUrl.match(/^\/redirect\?p\=(.+)$/i);
    return match && match[1] ? match[1] : false;
  }

  var redirectMatch = getRedirectUrl(req.url);

  if (redirectMatch) {
    var redirectTo;
    if(/^\/.*/.test(redirectMatch) || /^http[s]?:\/\/(.+)$/.test(redirectMatch)) {
      redirectTo = redirectMatch;
    } else {
      var parts = req.url.split('/');
      parts.pop();
      parts.push(redirectMatch)
      redirectTo = parts.join('/');
    }

    util.puts(req.headers.host.green.bold.underline +
      ' redirecting request from '.blue +
      'http://'.yellow.underline +
      req.headers.host.yellow.underline  +
      req.url.yellow.underline +
      ' to '.blue +
      redirectTo.green.underline
    );
    res.writeHead(301,{'Location' : redirectTo});
    res.end();
    return;
  }


  res.writeHead(200,{'Content-type': 'text/html'});
  var content = wrapInHtml('<pre>' + util.inspect(reqInfo) + '</pre>');
  res.write(content);
  res.end();

}).listen(backendPort);

// Setup a hostname based Routing proxy that emulates the behavior of
// Apache's mod_proxy ProxyPass and ProxyPass reverse
var proxyOptions  = {
    // Toggle Apache's mod_proxy emulation
  emulateModProxy: true,
  // This crude implemetation of mod proxy emulation isn't able to handle
  // source routes with paths, for now only root on the source can be
  // matched to the root path on the target
  hostnameOnly: true,
  router: {
    'foo.example.com' : 'backend1:8000',
    'bar.example.com' : 'backend2:8000'
  }
};

var proxy = new httpProxy.RoutingProxy(proxyOptions);

http.createServer(function (req, res) {
  util.puts(req.headers.host.green.bold.underline + ' received request with url '.blue + req.url.yellow);

  var source = req.headers.host.split(":");
  if(source.length == 1) {
    source.push(80);
  }

  proxy.proxyRequest(req, res);
}).listen(proxyPort);

//
// Catch requests not matched by RoutingProxy.proxyTable
//
proxy.on('routenotfound', function(req, res) {
  util.puts('Unable to find matching route for '.red.bold + req.headers.host.yellow.underline + req.url.yellow.underline + ' bailing out with `404`.'.red.bold);
  proxy.tryEndResponseWithNotFound(res);
});


util.puts('Routing proxy server'.blue + ' started '.green.bold + 'on port '.blue + proxyPort.toString().yellow);
util.puts('http server '.blue + 'started '.green.bold + 'on port '.blue + backendPort.toString().yellow);