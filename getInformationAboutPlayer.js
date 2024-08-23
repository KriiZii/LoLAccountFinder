// PACKAGES
const { log } = require("console");
const { writeFileSync, readFileSync } = require("fs");
require('dotenv').config();
const request = require('sync-request'); // Import sync-request

// CONSTANTS
const API_KEY = process.env.API_KEY;

const ACCOUNTS_SUBDOM = 'europe';
const SUMMONER_SUBDOM = 'euw1';

// UTILS
function makeSyncCall(url) {
    try {
        const res = request('GET', url, {
            headers: { "X-Riot-Token": API_KEY }
        });

        if (res.statusCode === 429) {
            // Handle rate limiting
            const retryAfter = parseInt(res.headers['retry-after']) + 2;
            responseFailed({ status: 429, headers: res.headers }, null);
            log(`Sleeping for ${retryAfter}s.....`);
            setTimeout(() => { return makeSyncCall(url); }, retryAfter * 1000);
        } else if (res.statusCode !== 200) {
            log(`API err: ${res.statusMessage}`);
            return null;
        }

        return JSON.parse(res.getBody('utf8'));
    } catch (error) {
        log(`Error making sync request: ${error.message}`);
        return null;
    }
}

function responseFailed(response, next, param = null) {
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers['retry-after']) + 2;
        log(`Sleeping for ${retryAfter}s.....`);
        setTimeout(() => { if (next) next(param); }, retryAfter * 1000);
    } else {
        log("API err:", response.statusText || "Unknown Error");
    }
}

// FUNCTIONS
let playerData = [];

log(`Starting...`);

function loadPlayersFromFile() {
    try {
        const data = readFileSync('./output.json');
        return JSON.parse(data);
    } catch (err) {
        log("Error reading output file:", err);
        return [];
    }
}

function saveToFile() {
    log("Saving results...");
    playerData.forEach(player => {
        delete player.summonerId;
        delete player.puuid;
        delete player.matches;
    })
    writeFileSync('./matches.json', JSON.stringify(playerData, null, 2));
    const csv = playerData.map(o => {
        const gameNameAndTagLine = `${o.gameName}#${o.tagLine}`;
        const championsList = o.champions.join(' ');
		return [gameNameAndTagLine, championsList].join(`,`);
    }).join('\n')

	log("Exporting .csv file..."); //logs when it's exporting
	writeFileSync('./output.csv', csv); //writes the file in csv
    log("Done!");
}

// The whole object of a player is put into here
function getMatches(player) {
    const currentPlayerPuuid = player.puuid;
    const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/by-puuid/${currentPlayerPuuid}/ids?type=ranked`;
    const matchData = makeSyncCall(preparedUrl);

    if (!matchData) return; // If the request fails, skip further processing

    player.matches = matchData;
    playerData.push(player);
    log(`Getting champions for ${player.gameName}`);
    player.champions = [];
    player.roles = [];
    getPlayerInfo(player);
}

function getPlayerInfo(player) {
    const currentPlayerMatches = player.matches;
    currentPlayerMatches.forEach(match => {
        const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/${match}`;
        const matchData = makeSyncCall(preparedUrl);

        if (!matchData) return; // If the request fails, skip this match

        const allParticipants = matchData.info.participants;
        const participant = allParticipants.find(obj => obj.puuid === player.puuid);
        const championExists = player.champions.includes(participant.championName);
        if(!championExists) {
            player.champions.push(participant.championName);
        }
        let role = participant.teamPosition;
        if(role === "UTILITY") {
            role = "SUPPORT"
        }
        const roleExists = player.roles.includes(role);
        if(!roleExists) {
            player.roles.push(role);
        }
    });

    checkAndSave();
}

function checkAndSave() {
    const allPlayersProcessed = playerInfo.every(player => playerData.some(pd => pd.puuid === player.puuid));

    if (allPlayersProcessed) {
        saveToFile();
    }
}

let playerInfo = loadPlayersFromFile();

if (playerInfo.length > 0) {
    playerInfo.forEach(player => {
        log(`Getting matches for ${player.gameName}`);
        getMatches(player);
    });
} else {
    log("No players found in the file.");
}
