var request = require('request'),
	async = require('async'),
	pkg = require('./package.json'),
	nano = require('nano');


async.reduce(Object.keys(pkg.apps), {}, function (memo, app, done) {
	var id = pkg.apps[app],
		url = 'https://chrome.google.com/webstore/detail/' + id + '?utm_source=chrome-ntp-icon';

	request(url, function (err, res, body) {
		memo[app] = -1;
		
		if (err) {
			done(err, memo);
		} else if (res.statusCode === 200) {
			var matched = body.match(/\"([0-9][^u]+)users\"/);
			
			if (matched) {
				memo[app] = parseInt(matched.pop().replace(/[,\s]+/, ''));
			}
		}
		done(null, memo);
	});
	
}, function (err, res) {
	if (err) {
		throw err;
	}
	
	var day = Math.floor(Date.now() / 1000 / 60 / 60 / 24) + 2,
		authCookie;

	
	// Create a connection to the db and ge the cookie
	nano(pkg.db.host).auth(pkg.db.username, pkg.db.password, function (err, body, headers) {
		if (err) {
			throw err;
		}

		if (headers && headers['set-cookie']) {
			authCookie = headers['set-cookie'];
		}

		var db = nano({
				url		: pkg.db.host,
				cookie	: authCookie
			});
		
		// Save to couch
		async.forEach(Object.keys(res), function (app, done) {
			var doc = {
					_id		: app + '-' + day,
					type	: 'stat',
					app		: app,
					day		: day,
					users	: res[app]
				};
						
			db.get(doc._id, function (err, res) {
				if (!err) {
					doc._rev = res._rev;
				}
				db.insert(doc, done);
			});


		}, function (err) {
			if (err) {
				throw err;
			}
			console.log('======== Stats saved ========');

			Object.keys(res).forEach(function (app) {
				var padding = new Array(8 - app.length).join(' ');
				
				console.log(padding + app + ' : ' + res[app]);
			});
			
			console.log('\n');
		});
	});
});
