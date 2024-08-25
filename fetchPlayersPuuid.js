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
            responseFailed({ status: 429, headers: res.headers }, url);
            return makeSyncCall(url);
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

function blockSleep(seconds) {
    const endTime = Date.now() + seconds * 1000;
    while (Date.now() < endTime) {
        // Sleep for 100 milliseconds between checks to reduce CPU usage
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
}

function responseFailed(response) {
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers['retry-after']) + 2;
        log(`Sleeping for ${retryAfter}s.....`);
        blockSleep(retryAfter);
    } else {
        log("API err:", response.statusText || "Unknown Error");
    }
}

// FUNCTIONS
function loadPlayersFromFile() {
    try {
        const data = readFileSync('./noPuuidPlayers.json');
        return JSON.parse(data);
    } catch (err) {
        log("Error reading output file:", err);
        return [];
    }
}

log(`Starting...`);

function saveToFile() {
    log("Saving results...");
    writeFileSync('./puuidOutput.json', JSON.stringify(seperatedPlayers, null, 2));
    log("Done!");
}

function getPuuid(player) {
    const currentPlayerGameName = encodeURIComponent(player.gameName);
    const currentPlayerTagLine = encodeURIComponent(player.tagLine);
    const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${currentPlayerGameName}/${currentPlayerTagLine}`;
    const puuids = makeSyncCall(preparedUrl);

    if (!puuids) return;

    player.puuid = puuids.puuid;
    checkAndSave();
}

function checkAndSave() {
    const allPlayersProcessed = seperatedPlayers.length === playersToGetPuuid.length && seperatedPlayers.every(player => player.hasOwnProperty('puuid') && player.puuid !== '');
    if (allPlayersProcessed) {
        saveToFile();
    }
}

let playersToGetPuuid = loadPlayersFromFile();

let seperatedPlayers = [];
playersToGetPuuid.forEach(playerString => {
    const playerArray = playerString.split("#");
    const player = {};
    player.gameName = String(playerArray[0]);
    player.tagLine = String(playerArray[1]);
    player.puuid = "";
    seperatedPlayers.push(player);
});

if (seperatedPlayers.length > 0) {
    seperatedPlayers.forEach(player => {
        log(`Getting puuid for ${player.gameName}`);
        getPuuid(player);
    });
} else {
    log("No players found in the file.");
}