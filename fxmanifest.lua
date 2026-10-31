name 'ai-streetraces'
author 'TGIANN'
version '0.1.0' -- x-release-please-version
license 'GPL-3.0-only'
description 'Street races started by players: a finish point, a buy-in, racers nearby join'
repository 'https://github.com/aifivem/ai-streetraces'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
}
