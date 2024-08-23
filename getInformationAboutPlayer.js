// PACKAGES
const { log } = require("console")
const { writeFileSync, readFileSync } = require("fs")

// CONSTANTS

const API_KEY = ""

const ACCOUNTS_SUBDOM = 'europe'
const SUMMONER_SUBDOM = 'euw1'

// UTILS

function makeCall(url) {
	return fetch(url, { headers: { "X-Riot-Token": API_KEY } })
}

function responseFailed(response, next, param = null) {
	if (response.status == 429) {
		const retryAfter = parseInt(response.headers.get("retry-after")) + 2
		log(`Sleeping for ${retryAfter}s.....`)
		setTimeout(() => { next(param) }, retryAfter * 1000)
	} else
		log("API err:", response.statusText)
}

// FUNCTIONS

let playerData = []

log(`Starting...`)

function loadPlayersFromFile() {
    try {
        const data = readFileSync('./output.json')
        return JSON.parse(data)
    } catch (err) {
        log("Error reading output file:", err)
        return []
    }
}

function saveToFile() {
	log("Saving results...")
	writeFileSync('./matches.json', JSON.stringify(playerData, null, 2))
	log("Done!")
}

//the whole object of a player is put into here
function getMatches(player) {
	//we select just the puuid of the player
	const currentPlayerPuuid = player.puuid
	const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/by-puuid/${currentPlayerPuuid}/ids?type=ranked` 
	makeCall(preparedUrl).then(response => { 
		if (!response.ok) 
			return responseFailed(response, getMatches, player)

		response.json().then(data => {
			//we make a new key called "matches" and put the data there
			player.matches = data
			//we push the player with the new matches into the empty playerData array
			playerData.push(player)
			log(`Getting champions for ${player.gameName}`)
			player.champions = []
			getChampionNames(player)
		})
	})
}

function getChampionNames(player) {
	//we select just the array with matches of the player
	const currentPlayerMatches = player.matches
	currentPlayerMatches.forEach(match => {
		const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/${match}`
		makeCall(preparedUrl).then(response => { 
			if (!response.ok) 
				return responseFailed(response, getMatches, player)
			
			//the response is a huge object
			response.json().then(data => {
				//this will be an array of every single participant
				const allParticipants = data.info.participants
				const participant = allParticipants.find(obj => obj.puuid === player.puuid)
				player.champions.push(participant.championName)
			})
		})
	})
	checkAndSave()
}

function checkAndSave() {
    const allPlayersProcessed = playerInfo.every(player => playerData.some(pd => pd.puuid === player.puuid));
    
    if (allPlayersProcessed) {
        saveToFile();
    }
}

let playerInfo = loadPlayersFromFile()

if (playerInfo.length > 0) {
    playerInfo.forEach(player => {
		log(`Getting matches for ${player.gameName}`)
        getMatches(player)
    })
} else {
    log("No players found in the file.")
}