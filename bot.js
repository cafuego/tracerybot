var svg2png = require('svg2png');
var async = require('async');

var _ = require('underscore');

var tracery = require('tracery-grammar');

var request = require("sync-request");

var sizeOf = require('image-size');

var dateFormat = require("dateformat");

var sleep = require('sleep');

const jsdom = require("jsdom");

// Make all the tweet vars and use them to populate rawGrammar below.
// Search the string 'CHANGEME'.
// There are RESULTS records, which means 0 - RESULTS/20 pages.
var page = Math.floor(Math.random()*(process.env.TROVE_SEARCH_RESULTS/20));
// Pick one of the 20 return items at random.
var item = Math.floor(Math.random()*20);
// Create the search query.
var options = {
  headers: {
    'X-Twitter-Bot': 'TraceryBot/v21',
    'Content-Type':  'application/x-www-form-urlencoded'
  },
  qs: {
    'key':         process.env.TROVE_API_KEY,
    'zone':        process.env.TROVE_SEARCH_ZONE,
    'l-category':  process.env.TROVE_SEARCH_CATEGORY,
    'q':           process.env.TROVE_SEARCH_QUERY,
    'n':           20,
    's':           page,
    'encoding':    'json'
  }
};
// Search for 20.
console.log('Items');
try {
  var response = request('GET', 'http://api.trove.nla.gov.au/result', options);
} catch (err) {
  console.log('Could not fetch items from Trove.');
  process.exit(1);
}
// Grab an article.
var json = JSON.parse(response.getBody('utf8'));
var article = json.response.zone[0].records.article[item]
// Create an image of the article.
var zoomLevel = '4';
var options = {
  headers: {
    'X-Twitter-Bot': 'TraceryBot/v21',
    'Content-Type':  'application/x-www-form-urlencoded'
  },
  qs: {
    '_': new Date().valueOf(),
  }
};
console.log('Prep');
var response = request('GET', 'http://trove.nla.gov.au/newspaper/rendition/nla.news-article' + article.id + '/level/' + zoomLevel + '/prep', options);
var hash = response.getBody('utf8');
var options = {
  headers: {
    'X-Twitter-Bot': 'TraceryBot/v21',
    'Content-Type':  'application/x-www-form-urlencoded'
  },
  qs: {
    '_':        new Date().valueOf(),
    'followup': hash
  }
};
sleep.sleep(1);
console.log('Ping');
var response = request('GET', 'http://trove.nla.gov.au/newspaper/rendition/nla.news-article' + article.id + '.' + zoomLevel + '.ping', options);
var options = {
  headers: {
    'X-Twitter-Bot': 'TraceryBot/v21',
    'Content-Type':  'application/x-www-form-urlencoded'
  },
  qs: {
    'followup': hash
  }
};
sleep.sleep(1);
console.log('Html');
var response = request('GET', 'http://trove.nla.gov.au/newspaper/rendition/nla.news-article' + article.id + '.' + zoomLevel + '.html', options);
var html = response.getBody('utf8');
// Extract the image URL.
const { JSDOM } = jsdom;
const doc = (new JSDOM(html)).window;

var image = 'http:' + doc.document.querySelector("img").src;

var options = {
  headers: {
    'X-Twitter-Bot': 'TraceryBot/v21',
    'Content-Type':  'application/x-www-form-urlencoded'
  }
};
console.log('Image');
var response = request('GET', image, options);
var buffer = response.getBody();
var dimensions = sizeOf(buffer);

// var tweet = article.heading + ' (' + dateFormat(date, "dddd, dS mmmm yyyy") + ') #trove ' + article.troveUrl;
// Ok then!

console.log('Going to post a tweet');

var troveUrl = 'http://trove.nla.gov.au/ndp/del/article/' + article.id;

// Rather hacky, the tweet is assembled here, as Tracery template.
// CHANGEME
var rawGrammar = { "origin": [ dateFormat(new Date(article.date), "d mmmm yyyy") + " - " + article.heading + " - " + article.title.value + " " + troveUrl + " {svg <svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"" + dimensions.width + "\" height=\"" + dimensions.height + "\" ><image width=\"" + dimensions.width + "\" height=\"" + dimensions.height + "\" xlink:href=\"" + image + "\" /></svg>}"] };

var generate_svg = function(svg_text, T, cb)
{
	
		svg2png(new Buffer(svg_text))
		.then(data => uploadMedia(data.toString('base64'), T, cb))
		.catch(e => cb(e));

}

var uploadMedia = function(b64data, T, cb)
{
	T.post('media/upload', { media_data: b64data }, function (err, data, response) {
		if (err)
		{
			cb(err);
		}
		else
		{
			cb(null, data.media_id_string);
		}
	});
}

var matchBrackets = function(text) {
  
  // simple utility function
  function reverseString(s) {
    return s.split('').reverse().join('');
  }

  // this is an inverstion of the natural order for this RegEx:
  var bracketsRe = /(\}(?!\\)(.+?)\{(?!\\))/g;

  text = reverseString(text);
  var matches = text.match(bracketsRe);
  if(matches === null) {
    return null;
  }
  else {
    return matches.map(reverseString).reverse();
  }
}

function removeBrackets (text) {
  
  // simple utility function
  var reverseString = function(s) {
    return s.split('').reverse().join('');
  }

  // this is an inverstion of the natural order for this RegEx:
  var bracketsRe = /(\}(?!\\)(.+?)\{(?!\\))/g;

  text = reverseString(text);
  return reverseString(text.replace(bracketsRe, ""));
}

var recurse_retry = function(origin, tries_remaining, processedGrammar, T, result, in_reply_to)
{

	if (tries_remaining <= 0)
	{
		return;
	}
	else
	{
		try
		{
			var tweet = processedGrammar.flatten(origin);
			console.log(tweet);

			var tweet_without_image = removeBrackets(tweet);
			var media_tags = matchBrackets(tweet);
			if (media_tags)
			{
				async.parallel(media_tags.map(function(match){
					if (match.indexOf("svg ") === 1)
					{
						return _.partial(generate_svg, match.substr(5,match.length - 6), T);
					}
					else if (match.indexOf("img ") === 1)
					{
						return _.partial(fetch_img, match.substr(5), T);
					}
					else
					{
						return function(cb){
							cb("error {" + match.substr(1,4) + "... not recognized");
						}
					}
				}),
				function(err, results)
				{
					if (err)
					{
						console.error("error generating SVG for " + result["screen_name"]);
						console.error(err);
						recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
						return;
					}
					var params = {};
					if (typeof in_reply_to === 'undefined')
					{
		  				params = { status: tweet_without_image, media_ids: results };
					}
					else
					{
						var screen_name = in_reply_to["user"]["screen_name"];
						params = {status: "@" + screen_name + " " + tweet_without_image, media_ids: results, in_reply_to_status_id:in_reply_to["id_str"]}
					}
					T.post('statuses/update', params, function(err, data, response) {
						if (err)
						{
						  	if (err["code"] == 186)
						  	{
						  		//console.log("Tweet (\"" + tweet + "\") over 140 characters - retrying " + (tries_remaining - 1) + " more times.");
						  		recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
						  	}
						  	else if (err['code'] == 187)
					  		{
					  			//console.log("Tweet (\"" + tweet + "\") a duplicate - retrying " + (tries_remaining - 1) + " more times.");
					  			recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
					  		}

						  	else if (err['code'] == 89)  
					  		{
					  			console.log("Account " + result["screen_name"] + " permissions are invalid");
					  		}
					  		else if (err['code'] == 226)  
					  		{
					  			console.log("Account " + result["screen_name"] + " has been flagged as a bot");
					  		}
					  		else if (err['statusCode'] == 404)
					  		{
					  			//unknown error
					  		}
					  		else
					  		{
					  			console.error("twitter returned error " + err['code'] + "for " + result["screen_name"] + " " + JSON.stringify(err, null, 2));  
					  			console.log("twitter returned error " + err['code'] + "for " + result["screen_name"]);  
					  			
					  		}
						  	
						 
						}

					});
				});

			}
			else
			{

	  			var params = {};
				if (typeof in_reply_to === 'undefined')
				{
	  				params = { status: tweet};
				}
				else
				{
					var screen_name = in_reply_to["user"]["screen_name"];
					params = {status: "@" + screen_name + " " + tweet, in_reply_to_status_id:in_reply_to["id_str"]}
				}
				//console.log("trying to tweet " + tweet + "for " + result["screen_name"]);
				T.post('statuses/update', params, function(err, data, response) {
					if (err)
					{
					  	if (err["code"] == 186)
					  	{
					  		//console.log("Tweet (\"" + tweet + "\") over 140 characters - retrying " + (tries_remaining - 1) + " more times.");
					  		recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
					  	}
					  	else if (err['code'] == 187)
				  		{
				  			//console.log("Tweet (\"" + tweet + "\") a duplicate - retrying " + (tries_remaining - 1) + " more times.");
				  			recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
				  		}

					  	else if (err['code'] == 89)  
				  		{
				  			console.log("Account " + result["screen_name"] + " permissions are invalid");
				  		}
				  		else if (err['code'] == 226)  
				  		{
				  			console.log("Account " + result["screen_name"] + " has been flagged as a bot");
				  		}
				  		else if (err['statusCode'] == 404)
				  		{
				  			//unknown error
				  			
				  		}
				  		else
				  		{
				  			console.error("twitter returned error " + err['code'] + "for " + result["screen_name"] + " " + JSON.stringify(err, null, 2));  
				  			console.log("twitter returned error " + err['code'] + "for " + result["screen_name"]);  
				  			
				  		}
					  	
					 
					}

				});
			}
		
			
		}
		catch (e)
		{
			if (tries_remaining <= 4)
			{
				console.error("error generating tweet for " + result["screen_name"] + " (retrying)\nerror: " + e.stack);
			}
			recurse_retry(origin, tries_remaining - 1, processedGrammar, T, result, in_reply_to);
		}
		
	}
};


var processedGrammar = tracery.createGrammar(rawGrammar);

processedGrammar.addModifiers(tracery.baseEngModifiers); 

// var tweet = processedGrammar.flatten("#origin#");


var Twit = require('twit');

var T = new Twit(
{
    consumer_key:         process.env.TWITTER_CONSUMER_KEY
  , consumer_secret:      process.env.TWITTER_CONSUMER_SECRET
  , access_token:         process.env.TWITTER_ACCESS_TOKEN
  , access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET
}
);

// console.log(T);

recurse_retry("#origin#", 5, processedGrammar, T);

// T.post('statuses/update', { status: tweet }, function(err, data, response) {
//   console.log(err)
//   // console.log(data)
//   // console.log(response)
// })
