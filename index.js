
const igdb = require('igdb-api-node').default

const igdbClient = igdb(process.env.IGDB_KEY)

const addonSDK = require('stremio-addon-sdk')

const addon = new addonSDK({
	id: 'org.igdbaddonsample',
	name: 'IGDB Addon',
	version: '0.0.1',
	description: 'Game trailer, gameplay videos from IGDB.com',
	resources: [ 'catalog', 'meta' ],
	types: [ 'channel' ],
	catalogs: [
		{
			type: 'channel',
			id: 'IGDBcatalog',
			name: 'Games',
			extraSupported: [ 'search' ]
		}
	],
	idPrefixes: [ 'igdb-' ]
})

function toMeta(igdbMeta) {

	let igdbBackground

	if (igdbMeta.screenshots && igdbMeta.screenshots.length) {
		igdbBackground = igdbMeta.screenshots[0].url
	} else if (igdbMeta.artworks && igdbMeta.artworks.length) {
		igdbBackground = igdbMeta.artworks[0].url
	}

	if (igdbBackground) {

		if (igdbBackground.startsWith('//'))
			igdbBackground = 'https:' + igdbBackground

		igdbBackground = igdbBackground.replace('/t_thumb/', '/t_original/')

	}

	let igdbGenres

	if (igdbMeta.genres && igdbMeta.genres.length) {
		igdbGenres = igdbMeta.genres.map(elem => { return elem.name })
	}

	let igdbPoster

	if (igdbMeta.cover && igdbMeta.cover.url) {

		igdbPoster = igdbMeta.cover.url.replace('/t_thumb/', '/t_cover_big/')

		if (igdbPoster.startsWith('//'))
			igdbPoster = 'https:' + igdbPoster

	}

	let igdbPlatforms

	if (igdbMeta.platforms && igdbMeta.platforms.length) {
		igdbPlatforms = 'Platforms: ' + igdbMeta.platforms.map(elem => { return elem.name }).join(', ')
	}

	let igdbYear

	if (igdbMeta.first_release_date) {
		igdbYear = parseInt(new Date(igdbMeta.first_release_date).getFullYear())
	}

	let igdbVideos

	if (igdbMeta.videos && igdbMeta.videos.length) {
		igdbVideos = igdbMeta.videos.map(elem => {
			return {
				id: 'yt_id::' + elem.video_id,
				title: elem.name,
				thumbnail: 'https://img.youtube.com/vi/' + elem.video_id + '/default.jpg'
			}
		})
	}

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

addon.defineCatalogHandler((args, cb) => {

	if (args.extra && args.extra.search) {

		// search

		igdbClient.games({
			fields: [ 'name', 'cover' ],
			limit: 30,
			order: 'popularity:desc',
			search: args.extra.search
		}).then(res => {

			if (res && res.body && res.body.length) {
				cb(null, { metas: res.body.map(toMeta) })
			} else {
				cb(null, null)
			}

		}).catch(err => {
			cb(err, null)
		})

	} else if (args.type == 'channel' && args.id == 'IGDBcatalog') {

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
				cb(null, { metas: res.body.map(toMeta) })
			} else {
				cb(new Error('Received Invalid Catalog Data'), null)
			}

		}).catch(err => {
			cb(err, null)
		})

	} else {
		cb(new Error('Invalid Catalog Request'), null)
	}

})

addon.defineMetaHandler((args, cb) => {
	if (args.type == 'channel' && args.id.startsWith('igdb-')) {

		igdbClient.games({
			fields: [ 'name', 'cover', 'first_release_date', 'screenshots', 'artworks', 'videos', 'genres', 'platforms', 'summary' ],
			ids: [ args.id.replace('igdb-', '') ],
			expand: [ 'genres', 'platforms' ]
		}).then(res => {
			if (res && res.body && res.body.length) {
				cb(null, { meta: toMeta(res.body[0]) })
			} else {
				cb(new Error('Received Invalid Meta'), null)
			}
		}).catch(err => {
			cb(err, null)
		})

	} else {
		cb(new Error('Invalid Meta Request'), null)
	}
})

addon.runHTTPWithOptions({ port: 7032 })
