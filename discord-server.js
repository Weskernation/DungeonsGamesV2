require('dotenv').config();

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const { Redis } = require('@upstash/redis');


// ==================================================
// TOEGANGSREGELS
// ==================================================

const ACCESS_RULES = {

    gmRules2014: [

        {
            guildId: '543792382190288907',
            // Dit is Dutch20

            roleIds: [
                // '618751130104496138', Community Guide
                '789857777035116544'
            ]
        },

        {
            guildId: '1526218644147802312',
            // Dit is Dungeons & Games D&D

            roleIds: [
                '1526220967695876248'
            // Dit is Game Master
            ]
        }

    ],


    gmRules2024: [

        {
            guildId: '543792382190288907',
            // Dit is Dutch20

            roleIds: [
                // '618751130104496138', Community Guide
                '789857777035116544'
            ]
        },

        {
            guildId: '1526218644147802312',
            // Dit is Dungeons & Games D&D

            roleIds: [
                '1526220967695876248'
            // Dit is Game Master
            ]
        }

    ]

};


// ==================================================
// SERVER CONFIGURATIE
// ==================================================

const app = express();

app.set('trust proxy', 1);

const PORT = 3000;


// ==================================================
// ONLINE GEBRUIKERS
// ==================================================

// Discord-gebruikers die momenteel online zijn
const onlineUsers = new Map();

// Anonieme/gastbezoekers die momenteel online zijn
const onlineGuests = new Set();


// ==================================================
// UPSTASH REDIS
// ==================================================

// Redis wordt gebruikt voor het bewaren van Express-sessies.
// Hierdoor blijven Discord-login en gast-sessies ook behouden
// wanneer de server opnieuw wordt gestart.

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
});


// ==================================================
// UPSTASH SESSION STORE
// ==================================================

class UpstashSessionStore extends session.Store {

    constructor() {
        super();

        this.prefix = 'sess:';
        this.defaultTtl = 86400;
    }


    // ----------------------------------------------
    // Redis key voor een sessie
    // ----------------------------------------------

    getKey(sid) {
        return `${this.prefix}${sid}`;
    }


    // ----------------------------------------------
    // Bepaal hoe lang een sessie geldig blijft
    // ----------------------------------------------

    getTtl(sess) {

        // Discord-gebruiker:
        // 14 dagen bewaren
        if (sess?.user) {
            return 14 * 24 * 60 * 60;
        }


        // Gast of tijdelijke keuzepagina:
        // slechts 1 minuut bewaren
        if (sess?.guest || sess?.canGuest) {
            return 60;
        }


        // Fallback naar cookie maxAge
        if (sess?.cookie?.maxAge != null) {
            return Math.max(
                1,
                Math.floor(sess.cookie.maxAge / 1000)
            );
        }


        return this.defaultTtl;
    }


    // ----------------------------------------------
    // Sessie ophalen
    // ----------------------------------------------

    get(sid, callback) {

        redis.get(this.getKey(sid))
            .then(data => {

                if (!data) {
                    return callback(null, null);
                }


                if (typeof data === 'string') {
                    return callback(null, JSON.parse(data));
                }


                return callback(null, data);

            })
            .catch(err => {

                console.error(
                    'Redis session GET fout:',
                    err
                );

                callback(err);

            });

    }


    // ----------------------------------------------
    // Sessie opslaan
    // ----------------------------------------------

    set(sid, sess, callback) {

        const ttl = this.getTtl(sess);

        redis.set(
            this.getKey(sid),
            JSON.stringify(sess),
            {
                ex: ttl
            }
        )
            .then(() => {

                callback(null);

            })
            .catch(err => {

                console.error(
                    'Redis session SET fout:',
                    err
                );

                callback(err);

            });

    }


    // ----------------------------------------------
    // Sessie verwijderen
    // ----------------------------------------------

    destroy(sid, callback) {

        redis.del(this.getKey(sid))
            .then(() => {

                callback(null);

            })
            .catch(err => {

                console.error(
                    'Redis session DELETE fout:',
                    err
                );

                callback(err);

            });

    }


    // ----------------------------------------------
    // Sessie vernieuwen
    // ----------------------------------------------

    touch(sid, sess, callback) {

        const ttl = this.getTtl(sess);

        redis.expire(
            this.getKey(sid),
            ttl
        )
            .then(() => {

                callback(null);

            })
            .catch(err => {

                console.error(
                    'Redis session TOUCH fout:',
                    err
                );

                callback(err);

            });

    }

}


const redisStore = new UpstashSessionStore();


// ==================================================
// ONLINE USER HELPERS
// ==================================================

function getOnlineUserList() {

    return Array.from(onlineUsers.values()).map(entry => {

        return {
            global_name:
                entry.user.global_name ||
                entry.user.username,

            username:
                entry.user.username
        };

    });

}


// ==================================================
// TOEGANGSCONTROLE
// ==================================================

async function hasAccess(
    accessToken,
    accessRules,
    memberCache
) {

    // Geen OAuth-token = geen toegang
    if (!accessToken) {
        return false;
    }


    // Geen regels = geen toegang
    if (
        !Array.isArray(accessRules) ||
        accessRules.length === 0
    ) {
        return false;
    }


    // ----------------------------------------------
    // Iedere toegangsregel controleren
    // ----------------------------------------------

    for (const rule of accessRules) {

        if (!rule.guildId) {
            continue;
        }


        if (
            !Array.isArray(rule.roleIds) ||
            rule.roleIds.length === 0
        ) {
            continue;
        }


        try {

            // ------------------------------------------
            // Membergegevens uit cache halen
            // ------------------------------------------

            if (
                !memberCache.has(rule.guildId)
            ) {

                const memberResponse =
                    await axios.get(

                        `https://discord.com/api/users/@me/guilds/${rule.guildId}/member`,

                        {
                            headers: {

                                Authorization:
                                    `Bearer ${accessToken}`

                            }

                        }

                    );


                memberCache.set(
                    rule.guildId,
                    memberResponse.data
                );

            }


            const member =
                memberCache.get(
                    rule.guildId
                );


            const memberRoles =
                member?.roles || [];


            // ------------------------------------------
            // Heeft gebruiker één van de toegestane
            // rollen?
            // ------------------------------------------

            const hasAllowedRole =
                rule.roleIds.some(
                    roleId =>
                        memberRoles.includes(roleId)
                );


            if (hasAllowedRole) {

                return true;

            }

        } catch (error) {

            // ------------------------------------------
            // 404 = geen lid van deze server
            // ------------------------------------------

            if (
                error.response?.status === 404
            ) {

                memberCache.set(
                    rule.guildId,
                    null
                );

                continue;

            }


            console.error(
                "Toegangscontrole Discord fout:",
                error.response?.status ||
                error.message
            );

        }

    }


    // Geen enkele combinatie toegestaan
    return false;

}


// ==================================================
// EXPRESS SESSION
// ==================================================

app.use(session({

    store: redisStore,

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',

        // Cookie maximaal 14 dagen geldig
        maxAge: 14 * 24 * 60 * 60 * 1000
    }

}));


// ==================================================
// STATIC FILES
// ==================================================

// Alles binnen /src kan als public bestand worden geladen.
//
// Bijvoorbeeld:
// /style.css
// /script.js
// /images/...
// /data/...
// /discord-widget/...

// index: false voorkomt dat Express automatisch
// src/index.html als / toont.

app.use(express.static(__dirname + '/src', {
    index: false
}));


// ==================================================
// PAGINA CONFIGURATIE
// ==================================================

// Tijdelijk bepaalt dit of de keuzepagina actief is.
//
// Later kunnen we dit verwijderen wanneer de
// definitieve landing/keuzestructuur klaar is.


// ==================================================
// PAGINA LADEN
// ==================================================
//
// Deze functie is bewust algemeen.
//
// Daardoor kunnen we later bijvoorbeeld:
//
// /2014/progression
// /2024/progression
//
// beide via dezelfde functie laten lopen.
//
// Alleen het bestand dat geladen moet worden verschilt.
//

function toonPagina(req, res, pagina) {

    let html = fs.readFileSync(
        __dirname + pagina,
        'utf8'
    );


    // ----------------------------------------------
    // Discord-gebruiker
    // ----------------------------------------------

    if (req.session.user) {

        console.log(
            "Gebruiker ingelogd:",
            req.session.user.username
        );

        const user = req.session.user;


        html = html.replace(
            'data-user=""',

            `data-user='${JSON.stringify({
                id: user.id,
                username: user.username,
                global_name:
                    user.global_name ||
                    user.username
            })}'`
        );

    } else {

        console.log("Gast bezoekt pagina");

    }


    res.send(html);
}


// ==================================================
// STARTPAGINA / LANDING
// ==================================================

app.get('/', (req, res) => {

    res.set('Cache-Control', 'no-store');


    console.log("STARTPAGINA bezocht");

    console.log(
        "Session ID:",
        req.sessionID
    );

    console.log(
        "Session user:",
        req.session.user
    );


    // ----------------------------------------------
    // Nieuwe landing page
    // ----------------------------------------------

    return toonPagina(
        req,
        res,
        '/src/pages/landing.html'
    );

});


// ==================================================
// 2014 CONTENT
// ==================================================

// ----------------------------------------------
// 2014 PLAYER RULES
// ----------------------------------------------

app.get('/2014/player-rules', (req, res) => {

    res.set('Cache-Control', 'no-store');

    console.log(
        "2014 player rules bezocht"
    );


    // PAGINA NOG NIET KLAAR
    return toonPagina(
        req,
        res,
        '/src/pages/access/not-ready.html'
    );


    // PAGINA KLAAR
    // return toonPagina(
    //     req,
    //     res,
    //     '/src/pages/2014/player-rules.html'
    // );

});


// ----------------------------------------------
// 2014 PROGRESSION
// ----------------------------------------------

app.get('/2014/progression', (req, res) => {

    res.set('Cache-Control', 'no-store');

    console.log(
        "2014 progression bezocht"
    );


    return toonPagina(
        req,
        res,
        '/src/pages/2014/progression.html'
    );

});


// ----------------------------------------------
// 2014 GM RULES
// ----------------------------------------------

app.get(
    '/2014/gm-rules',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );


        console.log(
            "2014 GM rules bezocht"
        );


        // ------------------------------------------
        // Niet ingelogd
        // ------------------------------------------

        if (!req.session.user) {

            console.log(
                "GM Rules geweigerd: niet ingelogd"
            );


            return toonPagina(
                req,
                res,
                '/src/pages/access/gm-login.html'
            );

        }


        // ------------------------------------------
        // PAGINA NOG NIET KLAAR
        // ------------------------------------------
        /*
        return toonPagina(
            req,
            res,
            '/src/pages/access/not-ready.html'
        );
        */

        
        // ------------------------------------------
        // TOEGANGSCONTROLE
        // ------------------------------------------

        const allowed =
            req.session.access?.gmRules2014 === true;


        console.log(
            "Toegang 2014 GM Rules:",
            allowed
        );


        // ------------------------------------------
        // Geen GM-toegang
        // ------------------------------------------

        if (!allowed) {

            console.log(
                "GM Rules geweigerd: geen juiste rol"
            );


            return toonPagina(
                req,
                res,
                '/src/pages/access/role-required.html'
            );

        }


        // ------------------------------------------
        // Toegang toegestaan
        // ------------------------------------------

        console.log(
            "GM Rules toegestaan"
        );


        return toonPagina(
            req,
            res,
            '/src/pages/2014/gm-rules.html'
        );
        

    }
);


// ==================================================
// 2024 CONTENT
// ==================================================

// ----------------------------------------------
// 2024 PLAYER RULES
// ----------------------------------------------

app.get('/2024/player-rules', (req, res) => {

    res.set('Cache-Control', 'no-store');

    console.log(
        "2024 player rules bezocht"
    );


    return toonPagina(
        req,
        res,
        '/src/pages/2024/player-rules.html'
    );

});


// ----------------------------------------------
// 2024 PROGRESSION
// ----------------------------------------------

app.get('/2024/progression', (req, res) => {

    res.set('Cache-Control', 'no-store');

    console.log(
        "2024 progression bezocht"
    );


    // PAGINA NOG NIET KLAAR
    return toonPagina(
        req,
        res,
        '/src/pages/access/not-ready.html'
    );


    // PAGINA KLAAR
    // return toonPagina(
    //     req,
    //     res,
    //     '/src/pages/2024/progression.html'
    // );

});


// ----------------------------------------------
// 2024 GM RULES
// ----------------------------------------------

app.get(
    '/2024/gm-rules',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );


        console.log(
            "2024 GM rules bezocht"
        );


        // ------------------------------------------
        // Niet ingelogd
        // ------------------------------------------

        if (!req.session.user) {

            console.log(
                "GM Rules 2024 geweigerd: niet ingelogd"
            );


            return toonPagina(
                req,
                res,
                '/src/pages/access/gm-login.html'
            );

        }


        // ------------------------------------------
        // PAGINA NOG NIET KLAAR
        // ------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/access/not-ready.html'
        );


        /*
        // ------------------------------------------
        // TOEGANGSCONTROLE
        // ------------------------------------------

        const allowed =
            req.session.access?.gmRules2024 === true;


        console.log(
            "Toegang 2024 GM Rules:",
            allowed
        );


        // ------------------------------------------
        // Geen GM-toegang
        // ------------------------------------------

        if (!allowed) {

            console.log(
                "GM Rules 2024 geweigerd: geen juiste rol"
            );


            return toonPagina(
                req,
                res,
                '/src/pages/access/role-required.html'
            );

        }


        // ------------------------------------------
        // Toegang toegestaan
        // ------------------------------------------

        console.log(
            "GM Rules 2024 toegestaan"
        );


        return toonPagina(
            req,
            res,
            '/src/pages/2024/gm-rules.html'
        );
        */        

    }
);


// ==================================================
// GASTTOEGANG
// ==================================================

// Direct naar /guest gaan geeft geen gasttoegang.
// De bezoeker moet eerst via / de keuze krijgen.

app.get('/guest', (req, res) => {

    console.log(
        "Directe GET naar /guest"
    );

    res.redirect('/');

});


// ----------------------------------------------
// POST /guest
// ----------------------------------------------

app.post('/guest', (req, res) => {

    res.set(
        'Cache-Control',
        'no-store'
    );


    console.log(
        "Gast probeert toegang te krijgen via POST"
    );


    // Alleen iemand die zojuist op de
    // keuzepagina zat mag gast kiezen.

    if (!req.session.canGuest) {

        console.log(
            "Geen toestemming voor gasttoegang"
        );

        return res.redirect('/');

    }


    console.log(
        "Gast kiest voor toegang zonder login"
    );


    req.session.guest = true;

    delete req.session.canGuest;


    req.session.save((err) => {

        if (err) {

            console.error(
                "Gast-sessie opslaan mislukt:",
                err
            );

            return res
                .status(500)
                .send(
                    "Sessie opslaan mislukt."
                );

        }


        res.redirect('/');

    });

});


// ==================================================
// DISCORD LOGIN START
// ==================================================
//
// Deze route start de Discord OAuth2-login.
// De daadwerkelijke verwerking gebeurt daarna
// in /auth/discord/callback.
//

app.get('/auth/discord', (req, res) => {

    // ------------------------------------------
    // Onthouden vanaf welke pagina de login
    // gestart werd
    // ------------------------------------------

    req.session.loginReturnTo =
        req.get('referer') || '/';


    console.log(
        "Discord login gestart vanaf:",
        req.session.loginReturnTo
    );


    const discordLoginUrl =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${process.env.DISCORD_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(
            process.env.DISCORD_REDIRECT_URI
        )}` +
        `&scope=identify+guilds.members.read`;


    res.redirect(discordLoginUrl);

});


// ==================================================
// DISCORD OAUTH2 CALLBACK
// ==================================================

app.get(
    '/auth/discord/callback',
    async (req, res) => {

        console.log(
            "=== DISCORD CALLBACK BEREIKT ==="
        );


        const code = req.query.code;


        // ------------------------------------------
        // Geen OAuth code
        // ------------------------------------------

        if (!code) {

            return res
                .status(400)
                .send(
                    'Geen code ontvangen.'
                );

        }


        try {

            // --------------------------------------
            // OAuth2 token ophalen
            // --------------------------------------

            const tokenResponse = await axios.post(

                'https://discord.com/api/oauth2/token',

                new URLSearchParams({

                    client_id:
                        process.env.DISCORD_CLIENT_ID,

                    client_secret:
                        process.env.DISCORD_CLIENT_SECRET,

                    grant_type:
                        'authorization_code',

                    code:
                        code,

                    redirect_uri:
                        process.env.DISCORD_REDIRECT_URI

                }),

                {

                    headers: {

                        'Content-Type':
                            'application/x-www-form-urlencoded'

                    }

                }

            );


            const accessToken =
                tokenResponse.data.access_token;


            // --------------------------------------
            // Discord gebruiker ophalen
            // --------------------------------------

            const userResponse =
                await axios.get(

                    'https://discord.com/api/users/@me',

                    {

                        headers: {

                            Authorization:
                                `Bearer ${accessToken}`

                        }

                    }

                );


            // --------------------------------------
            // Toegangsrechten bepalen
            // --------------------------------------

            const memberCache =
                new Map();


            req.session.access = {

                gmRules2014:
                    await hasAccess(
                        accessToken,
                        ACCESS_RULES.gmRules2014,
                        memberCache
                    ),

                gmRules2024:
                    await hasAccess(
                        accessToken,
                        ACCESS_RULES.gmRules2024,
                        memberCache
                    )

            };


            console.log(
                "Toegangsrechten:",
                req.session.access
            );


            // --------------------------------------
            // Gebruiker in sessie opslaan
            // --------------------------------------

            req.session.user =
                userResponse.data;


            console.log(
                "Sessie opgeslagen voor:",
                req.session.user
            );


            console.log(
                "Session ID:",
                req.sessionID
            );


            // --------------------------------------
            // Terug naar pagina waar login gestart werd
            // --------------------------------------

            const loginReturnTo =
                req.session.loginReturnTo || '/';


            delete req.session.loginReturnTo;


            console.log(
                "Terugsturen naar:",
                loginReturnTo
            );


            res.redirect(loginReturnTo);


        } catch (error) {

            console.error(
                "Discord API fout:"
            );


            console.error(
                error.response?.status ||
                error.message
            );


            console.error(
                error.response?.data ||
                ''
            );


            res
                .status(500)
                .send(
                    'Discord login mislukt.'
                );

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

app.get('/logout', (req, res) => {

    console.log(
        "Logout uitgevoerd"
    );


    req.session.destroy((err) => {

        if (err) {

            console.log(
                "Destroy fout:",
                err
            );

            return res.send(
                "Logout fout"
            );

        }


        res.redirect('/');

    });

});


// ==================================================
// HTTP SERVER + SOCKET.IO
// ==================================================

const server = http.createServer(app);

const io = new Server(server);


// ==================================================
// SOCKET.IO CONNECTION
// ==================================================

io.on('connection', (socket) => {

    let currentUserId = null;

    let isGuest = false;


    console.log(
        'Nieuwe browser verbonden:',
        socket.id
    );


    // ==================================================
    // DISCORD GEBRUIKER REGISTREREN
    // ==================================================

    socket.on(
        'registerUser',
        (user) => {

            currentUserId = user.id;


            // ------------------------------------------
            // Nieuwe gebruiker toevoegen
            // ------------------------------------------

            if (!onlineUsers.has(user.id)) {

                onlineUsers.set(
                    user.id,
                    {
                        user: user,
                        sockets: []
                    }
                );

            }


            // ------------------------------------------
            // Deze browser toevoegen aan gebruiker
            // ------------------------------------------

            onlineUsers
                .get(user.id)
                .sockets
                .push(socket.id);


            console.log(
                'Online gebruiker:',
                user.global_name ||
                user.username
            );


            console.log(
                'Unieke online gebruikers:',
                onlineUsers.size
            );


            // ------------------------------------------
            // Iedereen informeren
            // ------------------------------------------

            io.emit(
                'onlineUsers',
                {
                    users:
                        getOnlineUserList(),

                    guestCount:
                        onlineGuests.size
                }
            );

        }
    );


    // ==================================================
    // GAST REGISTREREN
    // ==================================================

    socket.on(
        'registerGuest',
        () => {

            isGuest = true;


            onlineGuests.add(
                socket.id
            );


            console.log(
                'Anonieme bezoeker online:',
                socket.id
            );


            console.log(
                'Aantal anonieme bezoekers:',
                onlineGuests.size
            );


            // ------------------------------------------
            // Iedereen informeren
            // ------------------------------------------

            io.emit(
                'onlineUsers',
                {
                    users:
                        getOnlineUserList(),

                    guestCount:
                        onlineGuests.size
                }
            );

        }
    );


    // ==================================================
    // BROWSER VERBINDING VERBROKEN
    // ==================================================

    socket.on(
        'disconnect',
        () => {


            // ------------------------------------------
            // Gast verwijderen
            // ------------------------------------------

            if (isGuest) {

                onlineGuests.delete(
                    socket.id
                );


                console.log(
                    'Anonieme bezoeker verwijderd:',
                    socket.id
                );

            }


            // ------------------------------------------
            // Discord gebruiker verwijderen
            // ------------------------------------------

            if (currentUserId) {

                const userEntry =
                    onlineUsers.get(
                        currentUserId
                    );


                if (userEntry) {

                    userEntry.sockets =
                        userEntry.sockets.filter(
                            id =>
                                id !== socket.id
                        );


                    // ----------------------------------
                    // Gebruiker volledig offline
                    // ----------------------------------

                    if (
                        userEntry.sockets.length === 0
                    ) {

                        onlineUsers.delete(
                            currentUserId
                        );

                    }

                }

            }


            console.log(
                'Browser verwijderd:',
                socket.id
            );


            console.log(
                'Unieke Discord-gebruikers:',
                onlineUsers.size
            );


            console.log(
                'Anonieme bezoekers:',
                onlineGuests.size
            );


            // ------------------------------------------
            // Iedereen informeren
            // ------------------------------------------

            io.emit(
                'onlineUsers',
                {
                    users:
                        getOnlineUserList(),

                    guestCount:
                        onlineGuests.size
                }
            );

        }
    );

});


// ==================================================
// SERVER STARTEN
// ==================================================

server.listen(
    PORT,
    () => {

        console.log(
            `Server draait op http://localhost:${PORT}`
        );

    }
);