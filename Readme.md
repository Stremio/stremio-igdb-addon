# Stremio IGDB Add-on

This Add-on allows you to fetch trailers and gameplag videos for video games from IGDB.com in Stremio

**As the IGDB.com API requires a Token in order to work, the `IGDB_KEY` process environment variable must be set prior to running this Add-on.**

## How to run

**Linux / OSX**

```
export IGDB_KEY="my-secret-api-key"
npm start
```

**Win**

```
set IGDB_KEY="my-secret-api-key"
npm start
```

## Tutorial


### 1. Setting dependencies

Create `package.json` and set dependencies

```json
{
	"name": "igdb-stremio-addon",
	"version": "0.0.1",
	"description": "Stremio Add-on for IGDB",
	"main": "index.js",
	"scripts": {
		"start": "node index.js"
	},
	"dependencies": {
		"stremio-addon-sdk": "^0.7.1",
		"igdb-api-node": "^3.1.7"
	}
}
```

We'll use `stremio-addon-sdk` to create our add-on and `igdb-api-node` to make requests to IGDB.


### 2. Define Add-on Manifest

Create your project's `index.js` and declare the add-on manifest.

See all manifest properties [here](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md)

```javascript
const addonSDK = require('stremio-addon-sdk')

const addon = new addonSDK({

	// id can be any string unique to each add-on:
	id: 'org.igdbaddon',

	// human readable name:
	name: 'IGDB Addon',

	version: '0.0.1',

	// add-on description:
	description: 'Game trailer, gameplay videos from IGDB.com',

	// resources we will respond with, can also be 'streams' and 'subtitles'
	resources: [ 'catalog', 'meta' ],

	// meta types we will use, can also be 'movie', 'series', 'tv' and 'other'
	types: [ 'channel' ],

	// catalogs we will serve:
	catalogs: [
		{
			// meta type this catalog responds with:
			type: 'channel',

			// id can be any string unique to each catalog:
			id: 'IGDBcatalog',

			// human readable name:
			name: 'Games',

			// supports search:
			extraSupported: [ 'search' ]
		}
	],

	// meta id prefix:
	idPrefixes: [ 'igdb-' ]
})

```


### 3. Convert IGDB Object to Meta Object

This function converts this [IGDB response object](https://gist.github.com/jaruba/d2a6ffc22c36647b01edb8bf1c94ed75) to this Stremio accepted [Meta object](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/meta.md)

```javascript
function toMeta(igdbMeta) {

	let igdbBackground

	if (igdbMeta.screenshots && igdbMeta.screenshots.length) {
		// use screenshot if we have any
		igdbBackground = igdbMeta.screenshots[0].url
	} else if (igdbMeta.artworks && igdbMeta.artworks.length) {
		// otherwise use artworks if we have any
		igdbBackground = igdbMeta.artworks[0].url
	}

	if (igdbBackground) {

		// add "https:"" prefix to url
		if (igdbBackground.startsWith('//'))
			igdbBackground = 'https:' + igdbBackground

		// convert thumbs to original images for background
		igdbBackground = igdbBackground.replace('/t_thumb/', '/t_original/')

	}

	let igdbGenres

	if (igdbMeta.genres && igdbMeta.genres.length) {
		// add game genres if we have any
		igdbGenres = igdbMeta.genres.map((elem) => { return elem.name })
	}

	let igdbPoster

	if (igdbMeta.cover && igdbMeta.cover.url) {
		// add poster
		igdbPoster = igdbMeta.cover.url.replace('/t_thumb/', '/t_cover_big/')

		// add "https:" prefix to url
		if (igdbPoster.startsWith('//'))
			igdbPoster = 'https:' + igdbPoster

	}

	let igdbPlatforms

	if (igdbMeta.platforms && igdbMeta.platforms.length) {
		// add platforms list to description
		igdbPlatforms = 'Platforms: ' + igdbMeta.platforms.map(elem => { return elem.name }).join(', ')
	}

	let igdbYear

	if (igdbMeta.first_release_date) {
		// add video game release year
		igdbYear = parseInt(new Date(igdbMeta.first_release_date).getFullYear())
	}

	let igdbVideos

	if (igdbMeta.videos && igdbMeta.videos.length) {
		// add youtube videos to streams
		igdbVideos = igdbMeta.videos.map(elem => {
			return {
				id: 'yt_id::' + elem.video_id,
				title: elem.name,
				thumbnail: 'https://img.youtube.com/vi/' + elem.video_id + '/default.jpg'
			}
		})
	}

	// map everything to Stremio meta object
	return {
		id: 'igdb-' + igdbMeta.id,
		name: igdbMeta.name,
		type: 'channel',
		poster: igdbPoster || null,
		description: igdbPlatforms || igdbMeta.summary || null,
		year: igdbYear,
		background: igdbBackground,
		genres: igdbGenres || null,
		videos: igdbVideos || []
	}

}

```


## 4. Include IGDB API module

Include the IDGB API module, make sure to create an account at IGDB to get a free API key for testing. You will set your IGDB API key in a process environment variable when you run the project.

```javascript
const igdb = require('igdb-api-node').default

const igdbClient = igdb(process.env.IGDB_KEY)

```


## 5. Meta Handler

Meta is requested when the Detail Page is accessed, it needs as much information as possible about the item to populate the Detail Page.

```javascript
addon.defineMetaHandler((args, cb) => {

	// ensure meta type and id are correct
	if (args.type == 'channel' && args.id.startsWith('igdb-')) {

		// request the meta id from IGDB
		igdbClient.games({
			fields: [ 'name', 'cover', 'first_release_date', 'screenshots', 'artworks', 'videos', 'genres', 'platforms', 'summary' ],
			ids: [ args.id.replace('igdb-', '') ],
			expand: [ 'genres', 'platforms' ]
		}).then(res => {
			if (res && res.body && res.body.length) {
				// igdb response is correct and has items
				// convert igdb object to stremio meta object
				// and respond to add-on request
				cb(null, { meta: toMeta(res.body[0]) })
			} else {
				// send error if invalid response from IGDB
				cb(new Error('Received Invalid Meta'), null)
			}
		}).catch(err => {
			// send IGDB request error as add-on response
			cb(err, null)
		})

	} else {
		// give error if meta type and id are incorrect
		cb(new Error('Invalid Meta Request'), null)
	}
})
```

## 6. Catalog Handler

In our case the catalog will be requested in two scenarios:
- Board or Discover Pages requested it
- Search Page requested it

We'll need to handle both of these cases, it should be mentioned that it is not uncommon for the catalog meta objects to include minimal information: `name`, `type`, `releaseInfo` and `poster`, as the catalog won't need more metadata to be shown correctly.

```javascript
addon.defineCatalogHandler((args, cb) => {

	if (args.extra && args.extra.search) {

		// search request

		// use IGDB api to search for query
		igdbClient.games({
			fields: [ 'name', 'cover' ],
			limit: 30,
			order: 'popularity:desc',
			search: args.extra.search
		}).then(res => {

			if (res && res.body && res.body.length) {
				// igdb response is correct and has items
				// convert igdb object to stremio meta object
				// and respond to add-on request
				cb(null, { metas: res.body.map(toMeta) })
			} else {
				// ignore search error, as it might just
				// have no search results
				cb(null, null)
			}

		}).catch(err => {
			// send IGDB request error as add-on response
			cb(err, null)
		})

	} else if (args.type == 'channel' && args.id == 'IGDBcatalog') {

		// get date values to limit catalog response between dates
		const today = new Date()

		const todayDate = today.toJSON().slice(0, 10) // format: 2018-01-01
		const previousYear = today.getFullYear() -1 // 2017

		igdbClient.games({
			fields: [ 'name', 'cover' ],
			limit: 30,
			order: 'popularity:desc',
			filters: {
				'release_dates.date-gt': previousYear + '-01-01',
				'release_dates.date-lt': todayDate
			}
		}).then(res => {

			if (res && res.body && res.body.length) {
				// igdb response is correct and has items
				// convert igdb object to stremio meta object
				// and respond to add-on request
				cb(null, { metas: res.body.map(toMeta) })
			} else {
				// send error if invalid response from IGDB
				cb(new Error('Received Invalid Catalog Data'), null)
			}

		}).catch(err => {
			// send IGDB request error as add-on response
			cb(err, null)
		})

	} else {
		// give error if unknown catalog request
		cb(new Error('Invalid Catalog Request'), null)
	}

})
```


### 7. Run Add-on

```javascript
addon.runHTTPWithOptions({ port: 7032 })
```

Now open a terminal window and [run your project](https://github.com/Stremio/stremio-igdb-addon/tree/tutorial#how-to-run)


### 8. Add to Stremio

Add `http://127.0.0.1:7032/manifest.json` to Stremio.

![addlink](https://user-images.githubusercontent.com/1777923/43146711-65a33ccc-8f6a-11e8-978e-4c69640e63e3.png)
