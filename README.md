This is a version of [Cheap Bots, Done Quick!](http://cheapbotsdonequick.com/) that runs as a single bot to tweet items found on Trove, with a screenshot attached.

Basic instructions for usage:
- clone this repo to a Linux server
- get it set up as a Node app (install Node, if needed, then run `npm install`)
- create a Twitter app on the developer site, register a Twitter account, do that OAuth dance (maybe using [http://v21.io/iwilldancetheoauthdanceforyou/](http://v21.io/iwilldancetheoauthdanceforyou/) ?)
- put the values you get from that into a file called `.env` (as in `.env_EXAMPLE`)
- sign up for an API key on Trove via [http://help.nla.gov.au/trove/building-with-trove/api](http://help.nla.gov.au/trove/building-with-trove/api) and add it in `.env`
- tweak your search query via the search api console at [http://troveconsole.herokuapp.com/](http://troveconsole.herokuapp.com/)
- add the trove query variables in `.env`:
 * TROVE_SEARCH_ZONE - the search zone
 * TROVE_SEARCH_CATEGORY - the search category
 * TROVE_SEARCH_QUERY - the string you want to search for. Use a space for ALL results
 * TROVE_SEARCH_RESULTS - the total number of results your query can return. this is the hacky way the bot uses to grab a random item. it's the total in the "records" line of the result
- add your Tracery code into the `rawGrammar` variable within `bot.js`. remember to escape any hashes if you want to add hash tags in your tweets
- call `run_bot.sh` whenever you want the bot to tweet (ie via `cron`)
