The project contains two key scripts:
1. fetchNewPlayers.js: This script goes through the League of Legends leaderboard (through ranks specified in RANKS_TO_GET) and saves accounts that could potentially belong to professional players.
2. getInformationAboutPlayer.js: After finding potential pro players, this script retrieves their last 20 (or less depending on when the account was created) matches and exports information about the champions they played, what summoner spells they used, what item slot they have zhonyas, boots, and control wards, and then it saves that in both JSON and CSV formats.

(Currently the program is a bit bugged though, because it doesn't pause when it's rate limited and just skips everything, but it works fine with going through 4 players or less)