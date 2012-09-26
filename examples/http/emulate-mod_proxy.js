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
    httpProxy = require('../../lib/node-http-proxy');

// Setup a hostname based Routing proxy that emulates the behavior of 
// Apache's mod_proxy ProxyPass and ProxyPass reverse
var proxyOptions  = {
  // Set proxied host header to target hostname.
  // This is needed in order to allow NameVirtualHosts on 
  // the backend server
  changeOrigin: true,
  // This crude implemetation of rewriteRedirects isn't able to handle
  // source routes with paths, for now only root on the source can be 
  // matched to the root path on the target
  hostnameOnly: true,
  // Enable rewriting of Location, Content-Location and URI fields on  
  // the target's response headers
  rewriteRedirects: false,
  router: {
    'foo.example.com' : 'backend1:80',
    'bar.example.com' : 'backend2:80'
  }
};

var proxy = new httpProxy.RoutingProxy(proxyOptions);

http.createServer(function (req, res) {
  var buffer = httpProxy.buffer(req);
  
  var source = req.headers.host.split(":");
  if(source.length == 1) {
    source.push(80);
  }

  proxy.proxyRequest(req, res, {
    buffer: buffer,
    source: {
      host: source[0],
      port: source[1]
    }
  });
}).listen(8004);

// Listen on the start event on the proxy to add mod_proxy
// compliant headers
proxy.on('start',function(req, res, target) {
  req.headers['X-Forwarded-Host'] = req.headers.host;
  req.headers['X-Forwarded-Server'] = req.headers.host.split(':')[0];
});
