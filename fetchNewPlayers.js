// PACKAGES
const { log } = require("console") //get log from console module and make it a constant
const { writeFileSync, existsSync } = require("fs") //get writeFileSync and existsSync from console module and make it a constant

// CONSTANTS

const API_KEY = "" //API Key

const ACCOUNTS_SUBDOM = 'europe' //subdomain for accounts-v1, this is for riot accounts, not league accounts
const SUMMONER_SUBDOM = 'euw1' //subdomain for league specific endpoints
const MAX_SUMMONER_LEVEL = 33 //max summoner level to search for accounts
const RANKS_TO_GET = [ //the ranks to find accounts in
	// "EMERALD/III",
	// "EMERALD/II",
	// "EMERALD/I",
	"DIAMOND/IV",
	// "DIAMOND/III",
	// "DIAMOND/II",
	// "DIAMOND/I",
]

// UTILS

function makeCall(url) { //creating a function called makeCall with an input called "url"
	return fetch(url, { headers: { "X-Riot-Token": API_KEY } }) //fetch function makes request, tell endpoint we have api key
}

function responseFailed(response, next, param = null) { //creates function called "responseFailed" with parameters, param = null means if a value isn't given it will default to null
	if (response.status == 429) { //if status of response is 429
		const retryAfter = parseInt(response.headers.get("retry-after")) + 2 //get's retry-after from riot api and assigns that to "retryAfter"
		log(`Sleeping for ${retryAfter}s.....`) //logs the time
		setTimeout(() => { next(param) }, retryAfter * 1000) //sets a timeout for the needed time in milliseconds
	} else //else statement
		log("API err:", response.statusText) //logs the error if it's something different than rate limits
}

// FUNCTIONS


let pageNumber = 1 //starting page number, should always be 1 unless debugging
let loadedSummoners = [] //makes empty array for loadedSummoners
const allSummoners = [] //makes empty array for allSummoners
const validSummoners = [] //makes empty array for validSummoners
const summonersWithNames = [] //makes empty array for summonerWithNames
let ranksIdx = 0 //index for ranks
let filterIdx = 0 //index for filtering
let validIdx = 0 //index for filtering as well

if (existsSync('./output.json')) //if a player already exists in the output, it won't log them again
	loadedSummoners = require('./output.json')


log(`Starting...`) //says when it's starting

nextRanks() //starts the nextRanks function

function nextRanks() { //function that is responsible for the script to go through all the ranks
	if (ranksIdx >= RANKS_TO_GET.length) { //if the index for ranks is greater/equal to the length of RANKS_TO_GET
		log(`Filtering players...`) //starts filtering the players
		return filterNewPlayers() //when it finishes with all the ranks it goes onto the next thing, won't continue with the other stuff
	}
	log(`Getting ranks ${RANKS_TO_GET[ranksIdx]}`) //says which ranks its currently getting
	getRankedPlayers(RANKS_TO_GET[ranksIdx]) //this is the function that will actually get the players, the input is which rank to get
}

function saveToFile() { //function that will run last and save the data to files
	log(`Named ${summonersWithNames.length} players.`) //logs how many players it named
	log("Saving results...") //says its saving
	writeFileSync('./output.json', JSON.stringify([...summonersWithNames, ...loadedSummoners])) //first param-where to write the data, second-what data to write

	const csv = summonersWithNames.map(o => //this converts it to csv
		Object.values(o).join(',')
	).join('\n')

	log("Exporting .csv file...") //logs when it's exporting
	writeFileSync('./output.csv', csv) //writes the file in csv
	log("UwU Done!") //logs when it's finished
}

function getRankedPlayers(url) { //function that gets the players from the leaderboard
	const preparedUrl = `https://${SUMMONER_SUBDOM}.api.riotgames.com/lol/league-exp/v4/entries/RANKED_SOLO_5x5/${url}?page=${pageNumber}` //makes a prepared version of the url
	makeCall(preparedUrl).then(response => { //makes a call to the api, then does stuff with the response
		if (!response.ok) //if the call failed
			return responseFailed(response, getRankedPlayers, url) //says what went wrong?

		response.json().then(data => { //convert response to json, then does rest
			if (!data.length) { //if the pages are empty
				log(`Checked ${pageNumber - 1} pages.`) //says how many pages it checked
				ranksIdx++ //pushes the index for ranks, so it goes onto the next rank
				pageNumber = 1 //sets the page number back to one
				return nextRanks() //does the function that checks if it finished all the ranks
			}
			if (pageNumber % 10 == 0) //this is for my zoomer brain to see it's doing something
				log(`Just got page no.${pageNumber}`)

			const filtered = data.filter(obj => { //this is what filters the stuff after it's collected
				return ( //returns true or false
					obj.freshBlood &&
					(obj.wins + obj.losses < 25) &&
					!loadedSummoners.some((value) => value.summonerId == obj.summonerId) //this makes it so it doesn't save already loaded summoners?
				)
			})
			allSummoners.push(...filtered) //adds the deconstructed filtered array onto allSummoners array
			pageNumber++ //goes onto the next page
			getRankedPlayers(url) //calls itself to go to next page
		})
	})
}

function filterNewPlayers() { //this is responsible for the second filtering, so this will only check the summoner level
	if (!allSummoners.length) //this checks when it finished
		return setTimeout(() => { //exit function and run function after a delay
			log(`Checked ${filterIdx} players.\nNaming players...`) //says how many players it checked and then that it's naming them
			getPlayerNames() //goes onto naming the players
		}, 500)

	const { summonerId } = allSummoners.shift() //grabs just the summonerId from player
	const url = `https://${SUMMONER_SUBDOM}.api.riotgames.com/lol/summoner/v4/summoners/${summonerId}` //prepares the url for checking summoner level
	makeCall(url).then(response => { //makes the call
		if (!response.ok) //if its not ok
			return responseFailed(response, filterNewPlayers) //says why it's not ok

		if (filterIdx && filterIdx % 10 == 0) //needed for zoomer brain
			log(`Checked ${filterIdx} players so far...`)

		response.json().then(data => {
			if (data.summonerLevel < MAX_SUMMONER_LEVEL) //if the summoner level is less than the max
				validSummoners.push({ summonerId, puuid: data.puuid }) //pushes the account to validSummoners as an object
			filterIdx++
			filterNewPlayers() //calls itself to repeat
		})
	})
}

function getPlayerNames() { //this function will get the names of the players
	if (!validSummoners.length) //if it's finished
		return saveToFile() //goes to the function that saves it to the file

	const { summonerId, puuid } = validSummoners.shift() //grabs just summonerId and puuid
	const url = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}` //the url
	makeCall(url).then(response => { //makes the call
		if (!response.ok) //if its not ok
			return responseFailed(response, getPlayerNames) //says why it's not ok

		if (validIdx && validIdx % 10 == 0) //for zoomer brain
			log(`Named ${validIdx} players so far...`)

		response.json().then(data => {
			summonersWithNames.push({ summonerId, ...data }) //pushes the named players to the array
			validIdx++
			getPlayerNames() //calls itself to repeat
		})
	})
}