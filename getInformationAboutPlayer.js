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
            responseFailed({ status: 429, headers: res.headers }, null);
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
const spellMap = {
    "7": "HEAL",
    "6": "GHOST",
    "21": "BARRIER",
    "3": "EXHAUST",
    "4": "FLASH",
    "12": "TELEPORT",
    "11": "SMITE",
    "1": "CLEANSE",
    "14": "IGNITE"
};

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
    writeFileSync('./newPlayerInfo.json', JSON.stringify(playerData, null, 2));
    const csv = playerData.map(o => {
        const gameNameAndTagLine = `${o.gameName}#${o.tagLine}`;
        const championsList = o.champions.join(' ');
        const playerRoles = o.roles.map(role => `${role[1]}x ${role[0]}`).join(" ");
        const playerSpell1 = o.summonerspell1.map(spell => `${spell[1]}x ${spell[0]}`).join(" ");
        const playerSpell2 = o.summonerspell2.map(spell => `${spell[1]}x ${spell[0]}`).join(" ");
        const zhonyaList = o.zhonyaPlacement.join(' ');
        const bootsList = o.bootsPlacement.join(' ');
        const controlWardList = o.controlWardPlacement.join(' ');
		return [gameNameAndTagLine, championsList, playerRoles, playerSpell1, playerSpell2, zhonyaList, bootsList, controlWardList].join(`,`);
    }).join('\n')

	log("Exporting .csv file..."); //logs when it's exporting
	writeFileSync('./newPlayerInfo.csv', csv); //writes the file in csv
    log("Done!");
}

// The whole object of a player is put into here
function getMatches(player) {
    const currentPlayerPuuid = player.puuid;
    const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/by-puuid/${currentPlayerPuuid}/ids?queue=420&type=ranked`;
    const matchData = makeSyncCall(preparedUrl);

    if (!matchData) return; // If the request fails, skip further processing

    player.matches = matchData;
    playerData.push(player);
    log(`Getting champions and roles for ${player.gameName}`);
    player.champions = [];
    player.roles = [];
    player.summonerspell1 = [];
    player.summonerspell2 = [];
    player.zhonyaPlacement = [];
    player.bootsPlacement = [];
    player.controlWardPlacement = [];
    getPlayerInfo(player);
}

function getPlayerInfo(player) {
    //Goes through every match
    const currentPlayerMatches = player.matches;
    currentPlayerMatches.forEach(match => {
        const preparedUrl = `https://${ACCOUNTS_SUBDOM}.api.riotgames.com/lol/match/v5/matches/${match}`;
        const matchData = makeSyncCall(preparedUrl);

        if (!matchData) return; // If the request fails, skip this match

        //Champions
        const allParticipants = matchData.info.participants;
        const participant = allParticipants.find(obj => obj.puuid === player.puuid);
        const championExists = player.champions.includes(participant.championName);
        if(!championExists) {
            player.champions.push(participant.championName);
        }

        //Roles
        let role = participant.teamPosition;
        if(role === "UTILITY") {
            role = "SUPPORT";
        }
        const roleIndex = player.roles.findIndex(item => item[0] === role);
        if (roleIndex === -1) {
            player.roles.push([role, 1]);
        }
        else {
            player.roles[roleIndex][1]++;
        }

        //Summoner Spells
        let Spell1 = getSummonerSpell(participant.summoner1Id);
        let Spell2 = getSummonerSpell(participant.summoner2Id);
        const spell1Index = player.summonerspell1.findIndex(item => item[0] === Spell1);
        const spell2Index = player.summonerspell2.findIndex(item => item[0] === Spell2);
        if (spell1Index === -1) {
            player.summonerspell1.push([Spell1, 1]);
        }
        else {
            player.summonerspell1[spell1Index][1]++;
        }
        if (spell2Index === -1) {
            player.summonerspell2.push([Spell2, 1]);
        }
        else {
            player.summonerspell2[spell2Index][1]++;
        }

        //Items
        const zhonyaItems = [3157, 223157, 2420];
        for (let i = 0; i <= 5; i++) {
            let itemId = participant[`item${i}`];
            if (zhonyaItems.includes(itemId)) {
                if (i>=3) {
                    let placement = `${i+2}`;
                    if (!player.zhonyaPlacement.includes(placement)) {
                        player.zhonyaPlacement.push(placement);
                    }
                }
                else {
                    let placement = `${i+1}`;
                    if (!player.zhonyaPlacement.includes(placement)) {
                        player.zhonyaPlacement.push(placement);
                    }
                }
            }
        }
        const boots = [1001, 3006, 3009, 3158, 3111, 3047, 3020, 3010, 2422, 3013];
        for (let i = 0; i <= 5; i++) {
            let itemId = participant[`item${i}`];
            if (boots.includes(itemId)) {
                if (i>=3) {
                    let placement = `${i+2}`;
                    if (!player.bootsPlacement.includes(placement)) {
                        player.bootsPlacement.push(placement);
                    }
                }
                else {
                    let placement = `${i+1}`;
                    if (!player.bootsPlacement.includes(placement)) {
                        player.bootsPlacement.push(placement);
                    }
                }
            }
        }
        const controlWard = [2055];
        for (let i = 0; i <= 5; i++) {
            let itemId = participant[`item${i}`];
            if (controlWard.includes(itemId)) {
                if (i>=3) {
                    let placement = `${i+2}`;
                    if (!player.controlWardPlacement.includes(placement)) {
                        player.controlWardPlacement.push(placement);
                    }
                }
                else {
                    let placement = `${i+1}`;
                    if (!player.controlWardPlacement.includes(placement)) {
                        player.controlWardPlacement.push(placement);
                    }
                }
            }
        }
    });
    checkAndSave();
}

function getSummonerSpell(spellId) {
    return spellMap[spellId] || spellId;
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
