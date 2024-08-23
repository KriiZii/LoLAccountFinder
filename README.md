The project contains two key scripts:
1. fetchNewPlayers.js: This script goes through the League of Legends leaderboard (through ranks specified in RANKS_TO_GET) and saves accounts that could potentially belong to professional players.
2. getInformationAboutPlayer.js: After finding potential pro players, this script retrieves their last 20 (or less depending on when the account was created) matches and exports information about the champions they played in both JSON and CSV formats.

Also, ignore the comments, I'm still learning and made these scripts with some help, and these comments are to help me when I want to make some changes.
