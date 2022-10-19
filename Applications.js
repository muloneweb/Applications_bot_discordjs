const fetch = require("node-fetch")
const express = require('express')
const ObjectId = require('mongodb').ObjectId
const { MongoClient } = require("mongodb")
const wait = require('node:timers/promises').setTimeout
const uri = "mongodb://127.0.0.1:27017/"
const monclient = new MongoClient(uri)
const { Client, Intents, MessageEmbed, ContextMenuInteraction } = require('discord.js')
const { token, key, botIds } = require('./appBotConfig.json')
const sanitize = require('mongo-sanitize')
const client = new Client({
    partials: ['GUILD_MEMBER', "CHANNEL"],
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
})

monclient.connect()
const app = express()
const wnDb = monclient.db("wn")
let neutral = ["array of discord servers ids"]
let warden = ["array of discord servers ids"]
let colonial = ["array of discord servers ids"]


// retrieves list of Steam friends
// for each one it checks if foxhole game ID is in the library
// if present, checks for VAC bans and if friends are already in the database
// filter first, then map
async function steamFriendsInfo(getNumbId, steamFriendsList) {

    let friendsWithFoxhole = []
    let getAllFriends = []
    let ids = []

    if (steamFriendsList) {
        const dbData = await wnDb.collection('Applications').find().toArray()
        let checkMatchingFriendsAlreadyInApps = Object.entries(dbData[0])
        checkMatchingFriendsAlreadyInApps[0] = [1, {}]
        const steamFriends = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${getNumbId}`)
        const applicantSteamFriend = await steamFriends.json()

        if (applicantSteamFriend.friendslist != undefined) {
            ids = applicantSteamFriend.friendslist.friends.map(e => e.steamid)
            getAllFriends = applicantSteamFriend.friendslist.friends.map(fetch(e => `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${e.steamid}&include_appinfo=true`).then(e => e.json()))
            const eachFriendGames = await Promise.all(getAllFriends)

            eachPersonLoop: for (let j = 0; j < eachFriendGames.length; j++) {
                if (eachFriendGames[j]?.response?.games != undefined) {
                    eachPersonGamesLoop: for (let i = 0; i < eachFriendGames[j]?.response?.games.length; i++) {
                        let game = eachFriendGames[j]?.response?.games[i]
                        if (game?.appid == "505460") {
                            friendsWithFoxhole.push([ids[j], game.playtime_forever, applicantSteamFriend.friendslist.friends[applicantSteamFriend.friendslist.friends.findIndex(e => e.steamid == ids[j])].friend_since, game.playtime_2weeks, ""])
                            let getBans = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&format=json&steamids=${ids[j]}`)
                            let playerBans = await getBans.json()
                            if (playerBans.players[0]?.VACBanned) friendsWithFoxhole[friendsWithFoxhole.length - 1][4] = `⚠️ ${playerBans.players[0].NumberOfVACBans} VAC Bans`

                            matchFriendsInDBLoop: for (let y = 0; y < checkMatchingFriendsAlreadyInApps.length; y++) {
                                if (checkMatchingFriendsAlreadyInApps[y][1]?.SteamID == ids[j]) friendsWithFoxhole[friendsWithFoxhole.length - 1][5] = checkMatchingFriendsAlreadyInApps[y][0]
                            }
                            break eachPersonGamesLoop
                        }
                    }
                }
            }
        }
        return friendsWithFoxhole
    }
}


async function createThreadApp(discordUser, servers, totalServers) {

    if (client.isReady()) {

        let msg
        // Interviews happen during **EU or NA evening times
        // current time is between 19:00 and 05:00
        if (new Date().getHours() >= 19 || new Date().getHours() <= 5) {
            msg = `__Interviews happen during **EU or NA evening times:__ 
So join **NOW** <#511126132431519744> voice channel
Application completed!`

        } else {
            // current time is outside 19:00 and 05:00
            const waittime = 19 - new Date().getHours()
            const left = 3600000 * waittime + Date.now()
            const epoch = Math.floor(left / 1000)
            msg = `__Interviews will take place during **EU or NA evening times:__                     
				
	 <t:${epoch}:R> join <#511126132431519744> voice channel, ping the Recruitment Officer role saying you are ready for an interview.
	Patiently wait in there for an officer to join. 
	Application completed!`
        }

        const user = client.users.cache.get(discordUser.id)
        user.send(msg)

        const channel = client.channels.cache.get("605956856828919816")
        const thread = await channel.threads.create({
            name: `📋 ${discordUser.username}`,
            auto_archive_duration: 1440,
            type: 'GUILD_PUBLIC_THREAD'
        })
        let userId = discordUser.id
        let dbData = await wnDb.collection('Applications').find({ [discordUser.id]: { "$exists": true } }).toArray()
        await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".threadID"]: thread.id } })

        let steamidsWithFoxhole = ""
        let collieServers = ""
        let nootServers = ""
        let wardenServers = ""

        wardenServers = servers[0].map(e => "```" + ` ${e[1]} ` + "```")
        collieServers = servers[1].map(e => "```" + ` ${e[1]} ` + "```")
        nootServers = servers[2].map(e => "```" + ` ${e[1]} ` + "```")

        if (nootServers.length == 0) nootServers += " \u200B"
        if (wardenServers.length == 0) wardenServers += " \u200B"

        let exampleEmbed = new MessageEmbed()
            .setColor('#0099ff')
            .setTitle(`STEAM:  ${dbData[0][userId].questions[6]}`)
            .setAuthor({ name: `${discordUser.username}` })
            .setThumbnail(`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`)
            .addFields(
                { name: 'Generalities', value: `Age:  ${dbData[0][userId].questions[0]}  ⠀⠀⠀⠀⠀ ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀Region: <@&${dbData[0][userId].region}>` },
                { name: 'Ever been colonial?', value: "```" + `${dbData[0][userId].questions[2]}` + "```", inline: false },
                { name: 'Previous clans/organizations', value: "```" + `${dbData[0][userId].questions[3]}` + "```", inline: false },
                { name: 'Favourite games, genres', value: "```" + `${dbData[0][userId].questions[4]}` + "```", inline: false },
                { name: 'Clan contributions, roles', value: "```" + `${dbData[0][userId].questions[5]} ` + "```", inline: false },
                { name: `Role Selected: `, value: `<@&${dbData[0][userId].role}>`, inline: false },
                { name: 'Where did you learn about The Warden Navy? Reason to join?', value: "```" + `${dbData[0][userId].questions[7]}` + "```", inline: false },
                { name: 'Open question', value: "```" + `${dbData[0][userId].questions[8]}` + "```", inline: false },
                { name: 'Total servers', value: "```" + `${totalServers}` + "```", inline: false },
                { name: '⚪ __Neutral Servers__', value: `${nootServers} \u200B`, inline: true },
                { name: '🔵 __Warden Servers__', value: `${wardenServers} \u200B`, inline: true },
            )
            .setFooter({ text: userId })
        if (collieServers.length != 0) exampleEmbed.addFields({ name: '🟢 __Colonial Servers__ ⚠️', value: `${collieServers} `, inline: false })

        client.channels.cache.get(thread.id).send({
            content: `New Application from: <@${discordUser.id}> <@&502931648195723264>`,
            embeds: [exampleEmbed],
            components: [
                {
                    "type": 1,
                    "components": [
                        {
                            "style": 3,
                            "label": `ACCEPT`,
                            "custom_id": `ACCEPT`,
                            "disabled": false,
                            "type": 2
                        },
                        {
                            "style": 2,
                            "label": `DENY`,
                            "custom_id": `DENY`,
                            "disabled": false,
                            "type": 2
                        },
                        {
                            "style": 1,
                            "label": `Ping for Interview (dm)`,
                            "custom_id": `pingrole`,
                            "disabled": false,
                            "emoji": {
                                "id": null,
                                "name": `🔔`
                            },
                            "type": 2
                        }
                    ]
                }
            ]
        })


        const discordEpoch = 1420070400000
        const convertsnowFlakeToDate = id => new Date(id / 4194304 + discordEpoch)
        const timeStamp = convertsnowFlakeToDate(Number(discordUser.id))
        const discCreated = timeStamp.toDateString().split(' ').slice(1).join(' ')
        const timeInMs = timeStamp.getTime()
        const monthsTime = Date.now() - timeInMs
        let elapsedMonths
        let timeAgo = ""

        let getGuild = await client.guilds.cache.get("467433493261975563")
        let userToAddRole = await getGuild.members.fetch(discordUser.id)

        //adds temporary role indicating user has submitted an application
        userToAddRole.roles.add("862390158141685790")

        if (monthsTime < 34186669833) {//13 months
            if (monthsTime < 86400000) {//24 hours
                elapsedMonths = Number(monthsTime) / 3600000 //1h
                let warnDay = elapsedMonths.toFixed(0)
                timeAgo = "`" + `⚠️ account made ${warnDay} hours ago!` + "`"
            }
            if (monthsTime < 2592000000) {//30d
                elapsedMonths = Number(monthsTime) / 86400000 //24h
                let warnMonth = elapsedMonths.toFixed(0)
                timeAgo = "`" + `⚠️ account made ${warnMonth} days ago!` + "`"
            }
            if (monthsTime < 34186669833) {
                elapsedMonths = Number(monthsTime) / 2629743833
                let warMonths = elapsedMonths.toFixed(0)
                timeAgo = "`" + `⚠️ account ${warMonths} months old!` + "`"
            }
        }

        const dateJoined = new Date(dbData[0][userId].joined)
        const joinedDiscordGuild = dateJoined.toDateString().split(' ').slice(1).join(' ')

        client.channels.cache.get(thread.id).send(`_ _
 __**Summary to check:**__
• **Age**: ${dbData[0][userId].questions[0]}  
• <:navy_banner:525619030283911178> joined WN:           ${joinedDiscordGuild}     
• <:disc:962328708562178128> account created:  ${discCreated}  [<@${userId}>]   ${timeAgo}`)

        let gamesCount
        let steamuserId
        let steamName
        let foxholeHours = "private"
        let lastTwoWeeks = "private"
        let banResults = ""
        let timeAgosteam = ""
        let needsTraining = ""
        let friendsResult = ""
        let topGames = ""
        let sorted = ""
        let steamCreated = ""
        let steamLink = ""
        let getNumbId = ""
        let steamUserGamesList = ""
        let bans = ""
        let steamFriendsList = ""
        let getuserIdFromVanityNick = ""

        steamLink = `${dbData[0][userId].questions[6]}`
        steamLink.split(" ").join("")
        if (steamLink[steamLink.length - 1] != "/") steamLink += "/"

        getNumbId = steamLink.split("/")[4]
        if (steamLink.startsWith("https://steamcommunity.com/profiles")) {
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&format=json&steamids=${getNumbId}`)
                steamuserId = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${getNumbId}&include_appinfo=true`)
                steamUserGamesList = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&format=json&steamids=${getNumbId}`)
                bans = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${getNumbId}`)
                steamFriendsList = await steamApi.json()
            } catch (e) { console.log(e) }
        }


        if (steamLink.startsWith("https://steamcommunity.com/id")) {
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${key}&vanityurl=${getNumbId}`)
                getuserIdFromVanityNick = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&format=json&steamids=${getuserIdFromVanityNick.response.steamid}`)
                steamuserId = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${getuserIdFromVanityNick.response.steamid}&include_appinfo=true`)
                steamUserGamesList = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&format=json&steamids=${getuserIdFromVanityNick.response.steamid}`)
                bans = await steamApi.json()
            } catch (e) { console.log(e) }
            try {
                let steamApi = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${getuserIdFromVanityNick.response.steamid}`)
                steamFriendsList = await steamApi.json()
            } catch (e) { console.log(e) }
        }

        try { gamesCount = steamUserGamesList.response.game_count } catch (e) { console.log(e) }

        function formatPlayTime(a) {
            let hour = Number(a) / 60
            let fixed = hour.toFixed(0)
            return hour < 1 ? "< 1h" : fixed
        }

        if (gamesCount < 5 && gamesCount !== undefined) gamesCount = gamesCount + " ⚠️"

        if (Object.keys(steamUserGamesList.response).length !== 0) {
            sorted = steamUserGamesList?.response?.games.sort((a, b) => b.playtime_forever - a.playtime_forever)
            topGames = `**${formatPlayTime(sorted[0]?.playtime_forever)}h** ${sorted[0]?.name}, 
							   **${formatPlayTime(sorted[1]?.playtime_forever)}h** ${sorted[1]?.name},
							   **${formatPlayTime(sorted[2]?.playtime_forever)}h** ${sorted[2]?.name}`

            for (let i = 0; i < steamUserGamesList?.response?.games.length; i++) {

                if (steamUserGamesList?.response?.games[i].appid == 505460) {
                    foxholeHours = Number(steamUserGamesList?.response?.games[i].playtime_forever) / 60
                    let hours = foxholeHours.toFixed(0)
                    foxholeHours = hours
                    if (foxholeHours < 35) {
                        needsTraining = "      <@&949604876919373874>"
                        await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [userId.toString() + ".training"]: "yes" } })
                    }
                    foxholeHours += "h "
                    if (steamUserGamesList?.response?.games[i].playtime_forever !== undefined && steamUserGamesList?.response?.games[i].playtime_2weeks !== undefined) {
                        lastTwoWeeks = Number(steamUserGamesList?.response?.games[i].playtime_2weeks) / 60
                        lastTwoWeeks = lastTwoWeeks.toFixed(0) + "h *past 2 weeks*"
                    }
                    if (steamUserGamesList?.response?.games[i].playtime_forever !== undefined && steamUserGamesList?.response?.games[i].playtime_2weeks == undefined) {
                        lastTwoWeeks = "(not played in 2 weeks)"
                    }
                    break
                } else {
                    foxholeHours = "`doesn't seem to own Foxhole` ⚠️"
                }
            }
            //Find extra games played by community
            if (steamUserGamesList?.response?.games.find(e => e.appid == 236390)) await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [userId.toString() + ".WARTHUNDER"]: "yes" } })
        }


        if (Object.keys(steamFriendsList).length == 0) {
            friendsResult = " private"
        } else if (steamFriendsList.friendslist.friends.length == 0) {
            friendsResult = " **0**" + "`" + "⚠️ " + "`"
        } else if (steamFriendsList.friendslist.friends.length < 4) {
            friendsResult = ` **${steamFriendsList.friendslist.friends.length}**` + "`" + "⚠️" + "`"
        } else if (steamFriendsList.friendslist.friends.length > 3) {
            friendsResult = ` **${steamFriendsList.friendslist.friends.length}** `
        }

        let steamDateZero = new Date(0)
        try {
            let checkSteamDifferenceInTime = steamDateZero.setUTCSeconds(steamuserId.response.players[0].timecreated)
            steamName = steamuserId.response.players[0].personaname
            steamCreated = steamDateZero.toDateString().split(' ').slice(1).join(' ')
            if ((Date.now() - checkSteamDifferenceInTime) < 32006669833) timeAgosteam = "`" + "⚠️ account made in the past year" + "`"
        } catch (e) { console.log(e) }

        steamuserId = getNumbId
        if (steamUserGamesList.response.game_count === undefined) {
            try {
                let steamApi = await fetch(`https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${key}&steamid=${steamuserId}`)
                let userBadges = await steamApi.json()
                try { gamesCount = userBadges.response.badges[0].level } catch (e) { console.log(e) }
            } catch (e) {
                gamesCount = "api not working"
            }
            topGames = "private"
        }

        if (bans != undefined) {
            if (bans.players[0].CommunityBanned.toString() == "true") banResults += "Community Banned ⚠️ \n"
            if (bans.players[0].VACBanned.toString() == "true") banResults += "VAC Banned ⚠️\n"
            if (bans.players[0].NumberOfVACBans > 0) banResults += `# of bans: ${bans.players[0].NumberOfVACBans} ⚠️\n`
            if (bans.players[0].NumberOfGameBans > 0) banResults += `# of game bans: ${bans.players[0].NumberOfGameBans} ⚠️\n`
            if (bans.players[0].DaysSinceLastBan > 0) banResults += `Days since last ban: ${bans.players[0].DaysSinceLastBan} ⚠️\n`
            if (banResults != "") banResults = "```" + banResults + "```"
        }

        if (steamLink.startsWith("https://steamcommunity.com/id")) getNumbId = getuserIdFromVanityNick.response.steamid

        await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [userId.toString() + ".SteamID"]: `${getNumbId}` } })
        let foxholefriends = await steamFriendsInfo(getNumbId, steamFriendsList)

        client.channels.cache.get(thread.id).send(`• <:stm:961944003702566943> account created:  ${steamCreated}  [${steamName}] ${timeAgosteam}

		Foxhole hours:  **${foxholeHours}**   ${lastTwoWeeks} ${needsTraining}
		Self reported:  ${dbData[0][userId].questions[1]}

		Games: **${gamesCount}**  
		Top Games: ${topGames}
		${banResults} 
		
Friends with (public) Foxhole:  ${foxholefriends?.length} / ${friendsResult}
		 `)

        if (foxholefriends.length != 0) {
            foxholefriends.sort((a, b) => b[2] - a[2])
            steamidsWithFoxhole = `__Friend since__     __Fox(h)__/` + "`" + `2w(h)` + "`" + `    __Steam Link__\n`
            for (let j = 0; j < foxholefriends.length; j++) {
                let matchingFriend = ""
                if (foxholefriends[j][5] != undefined)  matchingFriend = ` <@${foxholefriends[j][5]}>`
                
                let friendLastTwoWeeksPlaytime = foxholefriends[j][3] ? "`" + (foxholefriends[j][3] / 60).toFixed(0) + "h" + "`" : "    "
                steamidsWithFoxhole += "`" + `${new Date(foxholefriends[j][2] * 1000).toDateString().split(' ').slice(1).join(' ')}` + "`" + `   ${(foxholefriends[j][1] / 60).toFixed(0)}h ${friendLastTwoWeeksPlaytime}  ${matchingFriend}  <https://steamcommunity.com/profiles/${foxholefriends[j][0]}/> ${foxholefriends[j][4]}\n`

                if (steamidsWithFoxhole.length > 1900) {
                    client.channels.cache.get(thread.id).send(steamidsWithFoxhole)
                    steamidsWithFoxhole = ""
                }
                if (j == foxholefriends.length - 1) {
                    client.channels.cache.get(thread.id).send(steamidsWithFoxhole)
                    steamidsWithFoxhole = ""
                }
            }
        }


        try {
            userToAddRole.setNickname(`📋 ${userToAddRole.user.username}`)
        } catch (e) {
            console.log(e)
        }
    }
}


//OAuth2
app.get('/apps/application', async (req, res) => {

    let findNeutral = []
    let findWarden = []
    let findColonial = []
    let commonServers = []
    let bothRequests = []

    const code = req.query.code
    let body = new URLSearchParams()
    body.append('client_id', botIds.Appbot)
    body.append('client_secret', botIds.Appbot_secret)
    body.append('grant_type', 'authorization_code')
    body.append('code', code)
    body.append('redirect_uri', "https://wardennavy.com/apps/application")

    let accessToken = await fetch(`https://discordapp.com/api/oauth2/token`, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': `application/x-www-form-urlencoded` }
    }).then(res => res.json())

    bothRequests.push(fetch('https://discord.com/api/v10/users/@me/guilds', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken.access_token}` }
    }).then(e => e.json()))

    bothRequests.push(fetch('https://discord.com/api/v10/users/@me', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken.access_token}` }
    }).then(e => e.json()))

    res.redirect("https://wardennavy.com/apps/verification/completed")

    try {
        let oAuthResponse = await Promise.all(bothRequests)
        let user = oAuthResponse[oAuthResponse.length - 1]
        let servers = oAuthResponse.slice(0, oAuthResponse.length - 1)
        let totalServers = servers[0].length

        findWarden = servers[0].filter(e => warden.includes(e.id)).map(e => [e.id, e.name])
        findColonial = servers[0].filter(e => colonial.includes(e.id)).map(e => [e.id, e.name])
        findNeutral = servers[0].filter(e => neutral.includes(e.id)).map(e => [e.id, e.name])

        commonServers = [findWarden, findColonial, findNeutral]
        let dbData = await wnDb.collection('Applications').find({ [user.id]: { "$exists": true } }).toArray()

        if (dbData[0].length != 0) {
            if (dbData[0][user.id].threadID == "") {
                await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".refreshToken"]: accessToken.refresh_token } })
                await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".accessToken"]: accessToken.access_token } })
                await createThreadApp(user, commonServers, totalServers)
            }
        }
    } catch (e) {
        console.log(e)
    }
})


// If a member with an application leaves, updates the database
client.on("guildMemberRemove", async (member) => {
    try {
        let dbData = await wnDb.collection('Applications').find({ [member.user.id]: { "$exists": true } }).toArray()
        if (dbData.length != 0) {
            await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [member.user.id.toString() + ".appstatus"]: "left" } })
        }
    } catch (e) {
        console.log(e)
    }
})



client.on('interactionCreate', async interaction => {

    try {
        const { commandName } = interaction
        if ((interaction.isButton() && interaction.customId == "STARTAPP")) {

            let userId = interaction.user.id
            let now = Date.now()
            let dbData = await wnDb.collection('Applications').find({ [userId]: { "$exists": true } }).toArray()
            if (dbData.length == 0) {
                try {
                    interaction.reply({
                        content: 'Bot DMs you',
                        ephemeral: true,
                    })
                    await interaction.user.send(`Question1`)

                    let exampleEmbed = new MessageEmbed()
                        .setColor('#0099ff')
                        .setTitle(`${question[0]}`)

                    interaction.user.send({ embeds: [exampleEmbed] })
                    await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, {
                        $set: {
                            [userId]: {
                                joined: interaction.member.joinedtimeStamp,
                                username: interaction.user.username,
                                creationDate: now,
                                questions: [],
                                threadID: "",
                                appstatus: "pending",
                                refreshToken: "",
                            }
                        }
                    })
                } catch (e) {
                    console.log(e)
                    await interaction.reply({ "content": `<@${interaction.user.id}> The bot cannot start the Direct Message process: you probably have to enable Direct Messages in your settings. Then apply again`, ephemeral: true, "allowedMentions": { "replied_user": false, "parse": [] } })
                }
            } else {
                interaction.reply({
                    content: 'You already have an application. Check the bot DMs to see if you answered all the questions. If you did, ping a Recruit officer.',
                    ephemeral: true,
                })

            }
        }

        if (interaction.isButton()) {
            let userId = interaction.user.id
            if (interaction.customId == "AMERS" || interaction.customId == "EU" || interaction.customId == "ASIA-OCE") {

                let setRole
                if (interaction.customId == "AMERS") setRole = "516703731731922964"
                if (interaction.customId == "EU") setRole = "516703535560130562"
                if (interaction.customId == "ASIA-OCE") setRole = "523231965969907713"

                let dbData = await wnDb.collection('Applications').find({ [userId]: { "$exists": true } }).toArray()
                let questionsArray = dbData[0][userId].questions
                questionsArray.push(setRole)
                await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })

                let exampleEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(`${question[2]}`)
                interaction.update({
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 1,
                                    label: "AMERS",
                                    custom_id: "AMERS",
                                    disabled: true
                                },
                                {
                                    type: 2,
                                    style: 3,
                                    label: "EU",
                                    custom_id: "EU",
                                    disabled: true
                                },
                                {
                                    type: 2,
                                    style: 4,
                                    label: "ASIA-OCE",
                                    custom_id: "ASIA-OCE",
                                    disabled: true
                                }
                            ]
                        }
                    ]
                })
                const user = client.users.cache.get(userId)
                user.send({ embeds: [exampleEmbed] })
            }

            if (interaction.customId == "Logistics" || interaction.customId == "Partisans" || interaction.customId == "Builders" || interaction.customId == "Frontline") {

                let setRole
                if (interaction.customId == "Logistics") setRole = "501079731429703698"
                if (interaction.customId == "Partisans") setRole = "992936406391468132"
                if (interaction.customId == "Builders") setRole = "992936959779545123"
                if (interaction.customId == "Frontline") setRole = "992937491713769503"

                let dbData = await wnDb.collection('Applications').find({ [userId]: { "$exists": true } }).toArray()
                let questionsArray = dbData[0][userId].questions
                questionsArray.push(setRole)
                await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })


                //Disable all buttons
                interaction.update({
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Logistics",
                                    custom_id: "Logistics",
                                    disabled: true
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Partisans",
                                    custom_id: "Partisans",
                                    disabled: true
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Builders",
                                    custom_id: "Builders",
                                    disabled: true
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    label: "Frontline",
                                    custom_id: "Frontline",
                                    disabled: true
                                }
                            ]
                        }
                    ]
                })

                let exampleEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle("Link your Steam Profile URL. \nProfile must be set to PUBLIC")
                    .setImage('https://cdn.discordapp.com/attachments/992733207596380191/993106042781192282/steamURL.png')
                    .setThumbnail('https://cdn.discordapp.com/attachments/992733207596380191/993124776207986698/pngegg.png')
                const user = client.users.cache.get(userId)
                user.send({ embeds: [exampleEmbed] })
            }

            if (interaction.customId == "ACCEPT") {

                interaction.reply({ content: 'APP ACCEPTED', ephemeral: true, })

                let targetID = interaction.message.embeds[0].footer.text
                let dbData = await wnDb.collection('Applications').find({ [targetID]: { "$exists": true } }).toArray()
                let getGuild = await client.guilds.cache.get("467433493261975563")
                let userToAddRole = await getGuild.members.fetch(targetID)

                userToAddRole.setNickname(`[WN] ${userToAddRole.user.username}`)
                userToAddRole.roles.remove("862390158141685790")
                userToAddRole.roles.add("486623117335330846")
                userToAddRole.roles.add(dbData[0][targetID].region)

                if (dbData[0][interaction.message.embeds[0].footer.text].training == "yes") {
                    userToAddRole.roles.add("949604876919373874")
                    const findinEvent = await wnDb.collection('Training').find({}, { projection: { _id: 0 } }).toArray()
                    if (Date.now() - Number(findinEvent[0].time) < 162000000) {
                        userToAddRole.send(`As you are new to Foxhole, sign up for the Wednesday training session here:
						https://discord.com/events/467433493261975563/${findinEvent[0].event}`)
                    }
                }

                let applicationThread = client.channels.cache.get(interaction.message.channelId)
                if (applicationThread != undefined) {
                    try { await applicationThread.setName(`✅ ${interaction.message.embeds[0].author.name}  🛂${interaction.user.username}`) } catch (e) { console.log(e) }
                    try { await applicationThread.setArchived(true) } catch (e) { console.log(e) }
                }

                let link = `https://discord.com/channels/467433493261975563/${interaction.message.channelId}`
                const confirmembed = new MessageEmbed()
                    .setTitle('► Recruit Application ')
                    .setURL(link)
                    .setColor('0x0b8300')
                    .setDescription(`<@${interaction.message.embeds[0].footer.text}>   ⠀⠀⠀⠀⠀    🛂${interaction.user.username}`)
                    .setThumbnail('https://cdn.discordapp.com/attachments/713386376825143313/936951574310314004/output-onlinepngtools.png')

                client.channels.cache.get("605956856828919816").send({ embeds: [confirmembed] })
                await new Promise(resolve => setTimeout(resolve, 1000))
                await client.channels.cache.get("484110753297727488").send({
                    "content": `The only easy day was yesterday <@${interaction.message.embeds[0].footer.text}> \n > ⚓   **Welcome our new <@&486623117335330846> to the Navy!**`,
                    "allowedMentions": { "replied_user": false, "parse": ["users"] }
                })
                await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [interaction.message.embeds[0].footer.text.toString() + ".appstatus"]: "accepted" } })
            }

            if (interaction.customId == "DENY") {
                let thread = client.channels.cache.get(interaction.message.channelId)
                try { await thread.setName(`⛔ ${interaction.message.embeds[0].author.name}  🛂${interaction.user.username}`) } catch (e) { console.log(e) }
                await new Promise(resolve => setTimeout(resolve, 1000))
                await thread.setArchived(true)
                let link = `https://discord.com/channels/467433493261975563/${interaction.message.channelId}`
                const confirmembed = new MessageEmbed()
                    .setTitle('► Recruit Application ')
                    .setURL(link)
                    .setColor('0xab0000')
                    .setDescription(`<@${interaction.message.embeds[0].footer.text}>   ⠀⠀⠀⠀⠀    🛂${interaction.user.username}`)
                    .setThumbnail('https://cdn.discordapp.com/attachments/713386376825143313/936951556882972712/rrej.png')

                client.channels.cache.get("605956856828919816").send({ embeds: [confirmembed] })
                await wnDb.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [interaction.message.embeds[0].footer.text.toString() + ".appstatus"]: "denied" } })
                let getGuild = await client.guilds.cache.get("467433493261975563")
                let userToAddRole = await getGuild.members.fetch(interaction.message.embeds[0].footer.text)
                userToAddRole.roles.remove("862390158141685790")
            }

            if (interaction.customId == "pingrole") {
                await interaction.update({})
                let getGuild = await client.guilds.cache.get("467433493261975563")
                let userToAddRole = await getGuild.members.fetch(interaction.message.embeds[0].footer.text)
                userToAddRole.send(`⚓ Warden Navy Officers have read your application and are ready to do and interview with you.

Get your microphone ready and Join <#511126132431519744> process.
Good Luck!`)
                let reply = await client.channels.cache.get(interaction.message.channelId)
                reply.send(`<@${interaction.message.embeds[0].footer.text}> has been pinged by ${interaction.user.username} to join <#511126132431519744> for the interview.`)
            }
        }
    } catch (e) {
        console.log(e)
    }
})



client.on('messageCreate', async (msg) => {

    try {
        let questions = ["question1",
            "question2",
            "question3",
            "question4",
            "question5",
            "question6",
            "question7",
            "question8",
            "question9",
            "question10",
            `Submit app and Authorize`]

        async function askQuestionTwo(userId, dbData) {
            const exampleEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(questions[dbData[0][userId].questions.length + 1])
            const user = client.users.cache.get(userId)
            user.send({
                embeds: [exampleEmbed],
                components: [
                    {
                        type: 1,
                        components: [{ type: 2, style: 1, label: "AMERS", custom_id: "AMERS" },
                        { type: 2, style: 3, label: "EU", custom_id: "EU" },
                        { type: 2, style: 4, label: "ASIA-OCE", custom_id: "ASIA-OCE" }]
                    }
                ],
            })
        }

        async function askQuestionSix(userId, dbData) {
            let exampleEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setThumbnail('https://cdn.discordapp.com/attachments/992733207596380191/993166319530815539/uniform.png')
                .setTitle(questions[dbData[0][userId].questions.length + 1])
                .addFields(
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: 'LOGISTICS', value: '```Backbone of the team: Gathering, production and transport of supplies by land or sea to support the frontline```', inline: true },
                    { name: 'PARTISANS', value: '```Infiltrate behind enemy lines, disrupt their supply chains, steal and report weak points to exploit ```', inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: 'BUILDERS', value: '```Engineers that design and maintain bases and their defenses both in the frontline and backline```', inline: true },
                    { name: 'FRONTLINE', value: '```Capture bases through all warfare tools: Tanks, artillery, infantry and medics.```', inline: true },
                )

            const user = client.users.cache.get(userId)
            user.send({
                embeds: [exampleEmbed],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 2,
                                label: "Logistics",
                                custom_id: "Logistics"
                            },
                            {
                                type: 2,
                                style: 2,
                                label: "Partisans",
                                custom_id: "Partisans"
                            },
                            {
                                type: 2,
                                style: 2,
                                label: "Builders",
                                custom_id: "Builders"
                            },
                            {
                                type: 2,
                                style: 2,
                                label: "Frontline",
                                custom_id: "Frontline"
                            }
                        ]
                    }
                ],

            })
        }

        async function askQuestionSeven(userId, dbData, msg) {
            if (sanitize(msg.content).startsWith("https://steamcommunity.com") === false) {
                let exampleEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle("Link your Steam Profile URL. \nProfile must be set to PUBLIC")
                    .setImage('https://cdn.discordapp.com/attachments/992733207596380191/993106042781192282/steamURL.png')
                    .setThumbnail('https://cdn.discordapp.com/attachments/605956856828919816/891726949750296606/unknown.png')
                msg.reply({ embeds: [exampleEmbed] })
            } else {
                let questionsArray = dbData[0][userId].questions
                questionsArray.push(msg.content)
                await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })

                let exampleEmbed = new MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(questions[dbData[0][userId].questions.length + 1])
                msg.reply({ embeds: [exampleEmbed] })
            }
        }

        async function submitAuthorize(userId, dbData, msg) {
            let questionsArray = dbData[0][userId].questions
            questionsArray.push(msg.content)
            await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })

            let exampleEmbed = new MessageEmbed()
                .setColor('#0099ff')
                .setTitle(questions[dbData[0][userId].questions.length + 1])
            const user = client.users.cache.get(userId)

            user.send({
                embeds: [exampleEmbed],
                components: [
                    {
                        type: 1,
                        "components": [
                            {
                                "style": 5,
                                "label": `CONFIRM & AUTHORIZE`,
                                "url": `https://discord.com/api/oauth2/authorize?client_id=[CLIENT_ID]&redirect_uri=https%3A%2F%2Fwardennavy.com%2Fapps%2Fapplication&response_type=code&scope=guilds%20identify`,
                                "disabled": false,
                                "type": 2
                            }
                        ]
                    }
                ],
            })
        }



        if (msg.content.length < 1000) {
            if (msg.author.id != "992379621813260338") {

                let userId = msg.author.id.toString()
                let dbData = await wnDb.collection('Applications').find({ [userId]: { "$exists": true } }).toArray()
                if (dbData.length != 0) {

                    switch (dbData[0][msg.author.id].questions.length) {
                        //user timezone world map
                        case 0: {
                            await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(msg.content)] } })
                            await askQuestionTwo(msg.author.id, dbData)
                            break
                        }
                        //roles
                        case 5: {
                            let questionsArray = dbData[0][msg.author.id].questions
                            questionsArray.push(msg.content)
                            await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })
                            await askQuestionSix(msg.author.id, dbData)
                            break
                        }
                        case 6: {
                            //steam link
                            await askQuestionSeven(msg.author.id, dbData, msg)
                            break
                        }
                        case questions.length - 1: {
                            //submit & redirect to Oauth2
                            await submitAuthorize(msg.author.id, dbData, msg)
                            break
                        }
                        case questions.length: {
                            msg.reply(`If you have further questions you can ping @Recruitment Officer`)
                            break
                        }
                        default: {
                            await db1.collection('Applications').updateOne({ _id: ObjectId("34f3t3346g7565h53") }, { $set: { [user.id.toString() + ".questions"]: [sanitize(questionsArray)] } })
                            const exampleEmbed = new MessageEmbed()
                                .setColor('#0099ff')
                                .setTitle(questions[dbData[0][msg.author.id].questions.length + 1])
                            msg.reply({ embeds: [exampleEmbed] })
                        }
                    }
                }
            }
        }
    } catch (e) { console.log(e) }
})

client.login(token)

app.listen(4000, () => console.log("Server started"))