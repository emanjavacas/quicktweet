#! /usr/bin/env node

var fs = require('fs')
 , s = require('string')
 , request = require('request')
 , Q = require('q')
 , cheerio = require('cheerio')
 , argv = require('minimist')(process.argv.slice(2));

function buildOpts(opts){
    return Object.keys(opts).reduce(function(acc, k){
	return acc + k + "=" + opts[k] + "&";
    }, "&");
};

function buildOEmbed(user, tweet, opts){
    var path = "https://api.twitter.com/1/statuses/oembed.json?url=https://twitter.com/";
    return path + user + "/status/" + tweet + buildOpts(opts || {});
};


function parseBody(body){
    var html = JSON.parse(body)['html'];
    var $ = cheerio.load(html);
    var reg = new RegExp('https://twitter.com/(\\w{1,15})');
    var hashtags = [];
    var mentions = [];
    $('p > a').each(function(i, e){
	var match = reg.exec($(this).attr('href'));
	if(s($(this).attr('href')).endsWith('src=hash')) hashtags.push($(this).text());	
	if(match && match[1] !== 'hashtag') mentions.push(match[1]);
    });
    var result = {
	text: $('p').first().text(),
	screen_name: $('a').last().attr('href').split('/')[3],
	lang: $('p').attr('lang'),
	created_at: $('a').last().text(),
	hashtags: hashtags,
	mentions: mentions
    };
    return JSON.stringify(result);
}

function requestP(url){
    var deferred = Q.defer();
    request(url, function(err, res, body){
	if (err) deferred.reject(err);			    
	else if (! res.statusCode == 200){
	    err = new Error('Unexpected status: []' + res.statusCode);
	    err.res = res;
	    deferred.reject(err);
	}	
	deferred.resolve(body);
    });
    return deferred.promise;
}

function requestTweet(user, id, filename){
    var url = buildOEmbed(user, id, {omit_script:true});
    var promise = requestP(url);
    promise.then(
	function(body){
	// fs.appendFile(filename, user + "," + parseBody(body) + "\n");
	    console.log(parseBody(body));
	},
	function(err){
	    console.error(
		"An error [" + err.res.statusCode + "] occurred when " +
                "requesting from user [" + user + "] tweet [" + id + "]");
	});
    return promise;
}

if (argv._.length !== 2){
    console.error(
	'\n' +
	'Usage: $ node quicktweets.js inputfn outputfn\n' + '\n' +
        'Input file is a json array: [{user: "user", id: "tweetid"}]\n'+
	'A json object will be output for each found tweet with the format:\n'+
	'{\n   "text": text,\n   "screen_name": screen_name,\n   "lang": lang,\n'+
        '   "created_at": created_at,\n   "hashtags": [#1, #2, ...],\n'+
        '   "mentions": [screen_name1, screen_name2, ...]\n}' + '\n'
    );
    process.exit(1);
} else {
    var infn = argv._[0];
    var outfn = argv._[1];
    if (!fs.existsSync(argv._[0])){
	console.error("Input file does not exist");
	process.exit(1);
    }
    var tweets = require(infn);
    var promises = [];
    console.error("Procesing " + tweets.length + " tweets");   
    for(var i = 0; i < tweets.length; i++){
	var user = tweets[i].user.toString();
	var id = tweets[i].id.toString();
	var p = requestTweet(user, id, outfn);		
	promises.push(p);
    }
    Q.allSettled(promises).done(function(){
    	console.error("All done");
    	process.exit(0);
    });
}
