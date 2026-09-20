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
// SETTINGS BEHEERDERS
// ==================================================

const SETTINGS_ADMINS = [

'211255899535179776' //nation2495

];

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

const redisEnabled =
    !!(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
    );

const redis = redisEnabled
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
    : null;

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
// SETTINGS BEHEERDER CONTROLEREN
// ==================================================

function isSettingsAdmin(req) {

return (
    req.session.user &&
    SETTINGS_ADMINS.includes(
        req.session.user.id
    )
);

}

// ==================================================
// SETTINGS OPSLAG
// ==================================================

// Iedere deployment krijgt zijn eigen settings-versie.
// Daardoor blijven instellingen tijdelijk geldig,
// maar beginnen ze na een nieuwe deployment opnieuw
// vanaf de waarde uit config.js.

const SETTINGS_VERSION =
process.env.VERCEL_GIT_COMMIT_SHA ||
'local';

// ==================================================
// SETTINGS REDIS KEYS
// ==================================================

// Bestaande key voor de online teller behouden.
// Hierdoor verliezen we de bestaande instelling niet.

const ONLINE_COUNTER_SETTINGS_KEY =
    `settings:${SETTINGS_VERSION}:online-counter`;

// Nieuwe key voor alle overige settings.

const WEBSITE_SETTINGS_KEY =
    `settings:${SETTINGS_VERSION}:website`;

// ==================================================
// CONFIG.JS LEZEN
// ==================================================
//
// config.js wordt normaal door de browser gebruikt.
// Daarom laden we het bestand hier niet met require().
//
// We lezen alleen de tekst en halen de boolean waarden
// uit de bekende configuratievelden.
//

// ----------------------------------------------
// Boolean uit config.js halen
// ----------------------------------------------

function getConfigBoolean(
config,
expression,
defaultValue = false
) {

const match =
    config.match(expression);


if (!match) {

    return defaultValue;

}


return match[1] === 'true';

}

// ----------------------------------------------
// Alle basisinstellingen uit config.js lezen
// ----------------------------------------------

function getConfigSettings() {

try {

    const configPath =
        __dirname + '/src/js/config.js';


    const config =
        fs.readFileSync(
            configPath,
            'utf8'
        );


    return {

        versions: {

            dnd2014:
                getConfigBoolean(
                    config,
                    /dnd2014\s*:\s*(true|false)/
                ),

            dnd2024:
                getConfigBoolean(
                    config,
                    /dnd2024\s*:\s*(true|false)/
                ),

            dnd2034:
                getConfigBoolean(
                    config,
                    /dnd2034\s*:\s*(true|false)/
                )

        },


        pages: {

            dnd2014: {

                playerRules:
                    getConfigBoolean(
                        config,
                        /dnd2014\s*:\s*\{[\s\S]*?playerRules\s*:\s*(true|false)/
                    ),

                characterCreation:
                    getConfigBoolean(
                        config,
                        /characterCreation\s*:\s*(true|false)/
                    ),

                progression:
                    getConfigBoolean(
                        config,
                        /progression\s*:\s*(true|false)/
                    ),

                gmRules:
                    getConfigBoolean(
                        config,
                        /gmRules\s*:\s*(true|false)/
                    )

            },


            dnd2024: {

                playerRules:
                    getConfigBoolean(
                        config,
                        /dnd2024\s*:\s*\{[\s\S]*?playerRules\s*:\s*(true|false)/
                    ),

                characterCreation:
                    getConfigBoolean(
                        config,
                        /dnd2024\s*:\s*\{[\s\S]*?playerRules\s*:\s*(?:true|false)[\s\S]*?characterCreation\s*:\s*(true|false)/
                    ),

                progression:
                    getConfigBoolean(
                        config,
                        /dnd2024\s*:\s*\{[\s\S]*?progression\s*:\s*(true|false)/
                    ),

                gmRules:
                    getConfigBoolean(
                        config,
                        /dnd2024\s*:\s*\{[\s\S]*?gmRules\s*:\s*(true|false)/
                    )

            }

        },


        tooltips: {

            enabled:
                getConfigBoolean(
                    config,
                    /enabled\s*:\s*(true|false)/
                ),

            guestAllowed:
                getConfigBoolean(
                    config,
                    /guestAllowed\s*:\s*(true|false)/
                ),

            parchment:
                getConfigBoolean(
                    config,
                    /parchment\s*:\s*(true|false)/
                ),

            dnd2014:
                getConfigBoolean(
                    config,
                    /tooltips[\s\S]*?dnd2014\s*:\s*(true|false)/
                ),

            dnd2024:
                getConfigBoolean(
                    config,
                    /tooltips[\s\S]*?dnd2024\s*:\s*(true|false)/
                ),

            dnd2034:
                getConfigBoolean(
                    config,
                    /tooltips[\s\S]*?dnd2034\s*:\s*(true|false)/
                )

        },


        access: {
            gmRulesPublic:
                getConfigBoolean(
                    config,
                    /gmRulesPublic\s*:\s*(true|false)/
                )
        }

    };

} catch (error) {

    console.error(
        'config.js kon niet worden gelezen:',
        error
    );


    return {

        versions: {
            dnd2014: false,
            dnd2024: false,
            dnd2034: false
        },

        pages: {

            dnd2014: {
                playerRules: false,
                characterCreation: false,
                progression: false,
                gmRules: false
            },

            dnd2024: {
                playerRules: false,
                characterCreation: false,
                progression: false,
                gmRules: false
            }

        },

        tooltips: {
            enabled: false,
            guestAllowed: false,
            parchment: false,
            dnd2014: false,
            dnd2024: false,
            dnd2034: false
        },

        access: {

            gmRulesPublic: false

        }

    };

}

}

// ----------------------------------------------
// Huidige online-counter basiswaarde
// ----------------------------------------------

function getConfigOnlineCounter() {

try {

    const configPath =
        __dirname + '/src/js/config.js';


    const config =
        fs.readFileSync(
            configPath,
            'utf8'
        );


    const match =
        config.match(
            /const\s+ENABLE_ONLINE_COUNTER\s*=\s*(true|false)/
        );


    if (!match) {

        console.error(
            'ENABLE_ONLINE_COUNTER niet gevonden in config.js'
        );

        return true;

    }


    return match[1] === 'true';

} catch (error) {

    console.error(
        'config.js kon niet worden gelezen:',
        error
    );


    return true;

}

}

function getConfigVersions() {

    try {

        const configPath =
            __dirname + '/src/js/config.js';

        const config =
            fs.readFileSync(
                configPath,
                'utf8'
            );


        const versionsPattern =
            /versions\s*:\s*\{([\s\S]*?)\}/;

        const versionsMatch =
            config.match(versionsPattern);


        if (!versionsMatch) {

            throw new Error(
                'versions niet gevonden in config.js'
            );

        }


        const versionsConfig =
            versionsMatch[1];


        const versions = [
            'dnd2014',
            'dnd2024',
            'dnd2034'
        ];


        const result = {};


        for (const version of versions) {

            const versionPattern =
                new RegExp(
                    `${version}\\s*:\\s*(true|false)`
                );


            const versionMatch =
                versionsConfig.match(
                    versionPattern
                );


            if (!versionMatch) {

                throw new Error(
                    `${version} niet gevonden in config.js`
                );

            }


            result[version] =
                versionMatch[1] === 'true';

        }


        return result;

    } catch (error) {

        console.error(
            'Versie-instellingen konden niet uit config.js worden gelezen:',
            error
        );


        return {

            dnd2014: false,

            dnd2024: false,

            dnd2034: false

        };

    }

}

// ==================================================
// HUIDIGE D&D VERSIE INSTELLINGEN OPHALEN
// ==================================================

async function getVersionSettings() {

    // ----------------------------------------------
    // Config.js is altijd de basis
    // ----------------------------------------------

    const versions = getConfigVersions();

    // ----------------------------------------------
    // Redis kan een tijdelijke override bevatten
    // ----------------------------------------------

    for (const version of [
        'dnd2014',
        'dnd2024',
        'dnd2034'
    ]) {

        const savedSetting =
            await redis.get(
                `settings:${SETTINGS_VERSION}:version:${version}`
            );

        if (
            savedSetting !== null &&
            savedSetting !== undefined
        ) {

            versions[version] =
                savedSetting === true ||
                savedSetting === 'true';

        }
    }

    return versions;
}

function getConfigPages() {

    try {

        const configPath =
            __dirname + '/src/js/config.js';

        const config =
            fs.readFileSync(
                configPath,
                'utf8'
            );


        function getVersionPages(version) {

            const versionPattern =
                new RegExp(
                    `${version}\\s*:\\s*\\{([\\s\\S]*?)\\}`
                );


            const versionMatch =
                config.match(versionPattern);


            if (!versionMatch) {

                throw new Error(
                    `${version} niet gevonden in config.js`
                );

            }


            const versionConfig =
                versionMatch[1];


            const pages = [
                'playerRules',
                'characterCreation',
                'progression',
                'gmRules'
            ];


            const result = {};


            for (const page of pages) {

                const pagePattern =
                    new RegExp(
                        `${page}\\s*:\\s*(true|false)`
                    );


                const pageMatch =
                    versionConfig.match(pagePattern);


                if (!pageMatch) {

                    throw new Error(
                        `${version}.${page} niet gevonden in config.js`
                    );

                }


                result[page] =
                    pageMatch[1] === 'true';

            }


            return result;

        }


        return {

            dnd2014:
                getVersionPages('dnd2014'),

            dnd2024:
                getVersionPages('dnd2024')

        };

    } catch (error) {

        console.error(
            'Pagina-instellingen konden niet uit config.js worden gelezen:',
            error
        );


        return {

            dnd2014: {
                playerRules: false,
                characterCreation: false,
                progression: false,
                gmRules: false
            },

            dnd2024: {
                playerRules: false,
                characterCreation: false,
                progression: false,
                gmRules: false
            }

        };

    }

}

function getConfigTooltips() {

    try {

        const configPath =
            __dirname + '/src/js/config.js';

        const config =
            fs.readFileSync(
                configPath,
                'utf8'
            );


        const tooltipsPattern =
            /tooltips\s*:\s*\{([\s\S]*?)\}/;

        const tooltipsMatch =
            config.match(tooltipsPattern);


        if (!tooltipsMatch) {

            throw new Error(
                'tooltips niet gevonden in config.js'
            );

        }


        const tooltipsConfig =
            tooltipsMatch[1];


        const tooltipSettings = [
            'enabled',
            'guestAllowed',
            'parchment',
            'dnd2014',
            'dnd2024',
            'dnd2034'
        ];


        const result = {};


        for (const setting of tooltipSettings) {

            const settingPattern =
                new RegExp(
                    `${setting}\\s*:\\s*(true|false)`
                );


            const settingMatch =
                tooltipsConfig.match(
                    settingPattern
                );


            if (!settingMatch) {

                throw new Error(
                    `tooltips.${setting} niet gevonden in config.js`
                );

            }


            result[setting] =
                settingMatch[1] === 'true';

        }


        return result;

    } catch (error) {

        console.error(
            'Tooltip-instellingen konden niet uit config.js worden gelezen:',
            error
        );


        return {

            enabled: false,

            guestAllowed: false,

            parchment: false,

            dnd2014: false,

            dnd2024: false,

            dnd2034: false

        };

    }

}

// ==================================================
// SETTINGS OBJECT HELPERS
// ==================================================

// ----------------------------------------------
// Object veilig ophalen
// ----------------------------------------------

function getSettingObjectValue(
object,
category,
setting
) {

if (
    !object ||
    !object[category] ||
    typeof object[category][setting] !== 'boolean'
) {

    return null;

}


return object[category][setting];

}

// ----------------------------------------------
// Geneste setting wijzigen
// ----------------------------------------------

function setSettingObjectValue(
object,
category,
setting,
value
) {

if (!object[category]) {

    object[category] = {};

}


object[category][setting] = value;

}

// ==================================================
// HUIDIGE WEBSITE SETTINGS OPHALEN
// ==================================================

async function getWebsiteSettings() {

const configSettings =
    getConfigSettings();


const savedSettings =
    await redis.get(
        WEBSITE_SETTINGS_KEY
    );


let overrides = {};


if (savedSettings) {

    if (typeof savedSettings === 'string') {

        try {

            overrides =
                JSON.parse(savedSettings);

        } catch {

            overrides = {};

        }

    } else {

        overrides =
            savedSettings;

    }

}


// ----------------------------------------------
// Config als basis gebruiken
// ----------------------------------------------

const settings =
    JSON.parse(
        JSON.stringify(configSettings)
    );


// ----------------------------------------------
// Overrides toepassen
// ----------------------------------------------

for (const category of [
    'pages',
    'tooltips',
    'access'
]) {

    if (!overrides[category]) {
        continue;
    }


    for (const key of Object.keys(
        overrides[category]
    )) {

        if (
            typeof overrides[category][key] ===
            'boolean'
        ) {

            if (
                category === 'pages' &&
                typeof settings.pages[key] === 'object'
            ) {

                continue;

            }


            settings[category][key] =
                overrides[category][key];

        }

    }

}


// ----------------------------------------------
// D&D versies
// ----------------------------------------------

settings.versions =
    await getVersionSettings();


// ----------------------------------------------
// Pages zijn genest
// ----------------------------------------------

if (overrides.pages) {

    for (const version of [
        'dnd2014',
        'dnd2024'
    ]) {

        if (!overrides.pages[version]) {
            continue;
        }


        for (const page of Object.keys(
            overrides.pages[version]
        )) {

            if (
                typeof overrides.pages[version][page] ===
                'boolean'
            ) {

                settings.pages[version][page] =
                    overrides.pages[version][page];

            }

        }

    }

}


// ----------------------------------------------
// Online counter
// ----------------------------------------------

settings.onlineCounter = await getOnlineCounterSetting();


return settings;

}

// ==================================================
// WEBSITE SETTING OPSLAAN
// ==================================================

async function setWebsiteSetting(
category,
setting,
value
) {

const allowedCategories = [
    'versions',
    'pages',
    'tooltips',
    'access'
];


if (
    !allowedCategories.includes(category)
) {

    throw new Error(
        'Ongeldige settings categorie'
    );

}


const settings =
    await redis.get(
        WEBSITE_SETTINGS_KEY
    );


let overrides = {};


if (settings) {

    if (typeof settings === 'string') {

        try {

            overrides =
                JSON.parse(settings);

        } catch {

            overrides = {};

        }

    } else {

        overrides = settings;

    }

}


// ----------------------------------------------
// Geneste pages
// ----------------------------------------------

if (category === 'pages') {

    const allowedVersions = [
        'dnd2014',
        'dnd2024'
    ];


    if (!allowedVersions.includes(setting.version)) {

        throw new Error(
            'Ongeldige D&D versie'
        );

    }


    const allowedPages = [
        'playerRules',
        'characterCreation',
        'progression',
        'gmRules'
    ];


    if (!allowedPages.includes(setting.name)) {

        throw new Error(
            'Ongeldige pagina'
        );

    }


    if (!overrides.pages) {

        overrides.pages = {};

    }


    if (!overrides.pages[setting.version]) {

        overrides.pages[setting.version] = {};

    }


    overrides.pages[setting.version][setting.name] =
        value;

} else {

    if (!overrides[category]) {

        overrides[category] = {};

    }


    overrides[category][setting] =
        value;

}


await redis.set(
    WEBSITE_SETTINGS_KEY,
    JSON.stringify(overrides)
);

}

// ==================================================
// HUIDIGE ONLINE-COUNTER INSTELLING
// ==================================================

async function getOnlineCounterSetting() {

    const savedSetting =
        await redis.get(
            ONLINE_COUNTER_SETTINGS_KEY
        );

    if (
        savedSetting === null ||
        savedSetting === undefined
    ) {

        return getConfigOnlineCounter();

    }

    return savedSetting === true ||
        savedSetting === 'true';
}

// ==================================================
// ONLINE-COUNTER INSTELLING OPSLAAN
// ==================================================

async function setOnlineCounterSetting(enabled) {

await redis.set(
    ONLINE_COUNTER_SETTINGS_KEY,
    enabled
);

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

app.use(express.static(__dirname + '/src', {
index: false
}));

// ==================================================
// SETTINGS PAGINA
// ==================================================

app.get(
    '/settings',
    async (req, res) => {

        // ----------------------------------------------
        // Alleen settings-beheerders
        // ----------------------------------------------

        if (!isSettingsAdmin(req)) {

            let html;

            try {

                html =
                    fs.readFileSync(
                        __dirname +
                        '/src/pages/access/no-access-settings.html',
                        'utf8'
                    );

            } catch (error) {

                console.error(
                    'Geen toegang pagina laden mislukt:',
                    error
                );

                return res
                    .status(500)
                    .send(
                        'Geen toegang pagina kon niet worden geladen.'
                    );

            }

            return res
                .status(403)
                .send(html);

        }


        // ----------------------------------------------
        // Cache uitschakelen
        // ----------------------------------------------

        res.set(
            'Cache-Control',
            'no-store'
        );


        // ----------------------------------------------
        // Settings HTML inladen
        // ----------------------------------------------

        let html;

        try {

            html =
                fs.readFileSync(
                    __dirname +
                    '/src/pages/settings.html',
                    'utf8'
                );

        } catch (error) {

            console.error(
                'Settings pagina laden mislukt:',
                error
            );

            return res
                .status(500)
                .send(
                    'Settings pagina kon niet worden geladen.'
                );

        }


        // ----------------------------------------------
        // Effectieve website-instellingen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const publicSettings = {
            versions: settings.versions,
            pages: settings.pages,
            tooltips: settings.tooltips
        };

        html =
            html.replace(
                '<body',
                `<body data-site-settings='${JSON.stringify(publicSettings)}'`
            );


        // ----------------------------------------------
        // Discord-gebruiker
        // ----------------------------------------------

        if (req.session.user) {

            console.log(
                "Gebruiker ingelogd:",
                req.session.user.username
            );


            const user =
                req.session.user;


            html =
                html.replace(
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

            console.log(
                "Gast bezoekt pagina"
            );

        }


        return res.send(html);

    }
);

// ==================================================
// SETTINGS API
// ==================================================


// ==================================================
// SETTINGS OPHALEN
// ==================================================

app.get(
    '/api/settings',
    async (req, res) => {

        // ------------------------------------------
        // Alleen settings-beheerders
        // ------------------------------------------

        if (!isSettingsAdmin(req)) {

            return res
                .status(403)
                .json({
                    error: 'Geen toegang'
                });

        }


        try {

            const settings =
                await getWebsiteSettings();


            return res.json({

                ...settings,

                configOnlineCounter:
                    getConfigOnlineCounter()

            });

        } catch (error) {

            console.error(
                'Settings ophalen mislukt:',
                error
            );


            return res
                .status(500)
                .json({
                    error:
                        'Settings konden niet worden opgehaald'
                });

        }

    }
);

// ==================================================
// ONLINE COUNTER INSTELLING WIJZIGEN
// ==================================================
//
// Deze bestaande route blijft behouden zodat de
// huidige online-counter functionaliteit blijft werken.
//

app.post(
'/api/settings/online-counter',
express.json(),
async (req, res) => {

    // ------------------------------------------
    // Alleen settings-beheerders
    // ------------------------------------------

    if (!isSettingsAdmin(req)) {

        return res
            .status(403)
            .json({
                error: 'Geen toegang'
            });

    }


    // ------------------------------------------
    // Nieuwe waarde controleren
    // ------------------------------------------

    if (
        typeof req.body?.enabled !== 'boolean'
    ) {

        return res
            .status(400)
            .json({
                error: 'Ongeldige waarde'
            });

    }


    try {

        await setOnlineCounterSetting(
            req.body.enabled
        );


        console.log(
            'Online counter instelling gewijzigd:',
            req.body.enabled
        );


        return res.json({

            success: true,

            onlineCounter:
                req.body.enabled

        });

    } catch (error) {

        console.error(
            'Online counter wijzigen mislukt:',
            error
        );


        return res
            .status(500)
            .json({
                error:
                    'Instelling kon niet worden opgeslagen'
            });

    }

}

);

// ==================================================
// SETTINGS RESETTEN
// ==================================================
//
// Verwijdert alle tijdelijke settings van deze deployment.
// Daarna worden de waarden weer uit config.js gebruikt.
//

app.post(
    '/api/settings/reset',
    async (req, res) => {

        // ------------------------------------------
        // Alleen settings-beheerders
        // ------------------------------------------

        if (!isSettingsAdmin(req)) {

            return res
                .status(403)
                .json({
                    error: 'Geen toegang'
                });

        }


        try {

            // --------------------------------------
            // Website settings verwijderen
            // --------------------------------------

            await redis.del(
                WEBSITE_SETTINGS_KEY
            );


            // --------------------------------------
            // Online counter setting verwijderen
            // --------------------------------------

            await redis.del(
                ONLINE_COUNTER_SETTINGS_KEY
            );


            // --------------------------------------
            // Versie-instellingen verwijderen
            // --------------------------------------

            for (const version of [
                'dnd2014',
                'dnd2024',
                'dnd2034'
            ]) {

                await redis.del(
                    `settings:${SETTINGS_VERSION}:version:${version}`
                );

            }


            console.log(
                'Alle website settings gereset naar config.js'
            );


            return res.json({

                success: true,

                message:
                    'Settings zijn gereset naar config.js'

            });

        } catch (error) {

            console.error(
                'Settings resetten mislukt:',
                error
            );


            return res
                .status(500)
                .json({
                    error:
                        'Settings konden niet worden gereset'
                });

        }

    }
);

// ==================================================
// D&D VERSIE INSTELLING WIJZIGEN
// ==================================================

app.post(
    '/api/settings/version',
    express.json(),
    async (req, res) => {

        // ------------------------------------------
        // Alleen settings-beheerders
        // ------------------------------------------

        if (!isSettingsAdmin(req)) {

            return res
                .status(403)
                .json({
                    error: 'Geen toegang'
                });

        }


        // ------------------------------------------
        // Gegevens controleren
        // ------------------------------------------

        const version =
            req.body?.version;

        const enabled =
            req.body?.enabled;


        const allowedVersions = [
            'dnd2014',
            'dnd2024',
            'dnd2034'
        ];


        if (
            !allowedVersions.includes(version) ||
            typeof enabled !== 'boolean'
        ) {

            return res
                .status(400)
                .json({
                    error: 'Ongeldige waarde'
                });

        }


        try {

            // --------------------------------------
            // Redis key
            // --------------------------------------

            const key =
                `settings:${SETTINGS_VERSION}:version:${version}`;


            // --------------------------------------
            // Instelling opslaan
            // --------------------------------------

            await redis.set(
                key,
                enabled
            );


            console.log(
                `D&D versie ${version} gewijzigd:`,
                enabled
            );


            return res.json({

                success: true,

                version:
                    version,

                enabled:
                    enabled

            });

        } catch (error) {

            console.error(
                'D&D versie instelling opslaan mislukt:',
                error
            );


            return res
                .status(500)
                .json({
                    error:
                        'Instelling kon niet worden opgeslagen'
                });

        }

    }
);

// ==================================================
// ALGEMENE WEBSITE SETTING WIJZIGEN
// ==================================================
//
// Deze route wordt gebruikt voor:
// - D&D versies
// - pagina's
// - tooltips
//
// De frontend gaan we hierna hierop aansluiten.
//

app.post(
'/api/settings',
express.json(),
async (req, res) => {

    // ------------------------------------------
    // Alleen settings-beheerders
    // ------------------------------------------

    if (!isSettingsAdmin(req)) {

        return res
            .status(403)
            .json({
                error: 'Geen toegang'
            });

    }


    const {
        category,
        setting,
        value
    } = req.body || {};


    // ------------------------------------------
    // Waarde controleren
    // ------------------------------------------

    if (
        typeof value !== 'boolean'
    ) {

        return res
            .status(400)
            .json({
                error: 'Ongeldige waarde'
            });

    }


    try {

        await setWebsiteSetting(
            category,
            setting,
            value
        );


        console.log(
            'Website setting gewijzigd:',
            category,
            setting,
            value
        );


        const settings =
            await getWebsiteSettings();


        return res.json({

            success: true,

            settings:
                settings

        });

    } catch (error) {

        console.error(
            'Website setting wijzigen mislukt:',
            error
        );


        return res
            .status(400)
            .json({
                error:
                    error.message ||
                    'Instelling kon niet worden opgeslagen'
            });

    }

}

);

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

async function toonPagina(req, res, pagina) {

let html = fs.readFileSync(
    __dirname + pagina,
    'utf8'
);


// ----------------------------------------------
// Effectieve website-instellingen ophalen
// ----------------------------------------------

const settings =
    await getWebsiteSettings();


// ----------------------------------------------
// Alleen zichtbaarheid doorgeven aan de browser
// ----------------------------------------------

const publicSettings = {
    versions: settings.versions,
    pages: settings.pages,
    tooltips: settings.tooltips
};


// ----------------------------------------------
// Online counter instelling ophalen
// ----------------------------------------------

const onlineCounter =
    await getOnlineCounterSetting();


// ----------------------------------------------
// Online counter instelling aan <body> toevoegen
// ----------------------------------------------

html = html.replace(
    '<body',
    `<body data-online-counter="${onlineCounter}" data-site-settings='${JSON.stringify(publicSettings)}'`
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

app.get(
    '/2014/player-rules',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );


        console.log(
            "2014 player rules bezocht"
        );


        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();


        const pageEnabled =
            settings.pages.dnd2014.playerRules === true;


        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2014 Player Rules is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }


        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2014/player-rules.html'
        );

    }
);

// ----------------------------------------------
// 2014 CHARACTER CREATION
// ----------------------------------------------

app.get(
    '/2014/character-creation',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );

        console.log(
            "2014 character creation bezocht"
        );

        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const pageEnabled =
            settings.pages.dnd2014.characterCreation === true;

        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2014 Character Creation is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }

        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2014/character-creation.html'
        );

    }
);

// ----------------------------------------------
// 2014 PROGRESSION
// ----------------------------------------------

app.get('/2014/progression', async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );

        console.log(
            "2014 progression bezocht"
        );

        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const pageEnabled =
            settings.pages.dnd2014.progression === true;

        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2014 Progression is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }

        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2014/progression.html'
        );

    }
);

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

    // ----------------------------------------------
    // GM Rules publieke toegang controleren
    // ----------------------------------------------
    const settings =
        await getWebsiteSettings();

        // ----------------------------------------------
        // PAGINA BESCHIKBAARHEID
        // ----------------------------------------------

        const pageEnabled =
            settings.pages.dnd2014.gmRules === true;

        if (!pageEnabled) {

            console.log(
                "2014 GM Rules is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );
        }

    const gmRulesPublic =
        settings.access?.gmRulesPublic === true;


    // ----------------------------------------------
    // Niet ingelogd
    // ----------------------------------------------
    if (!gmRulesPublic && !req.session.user) {
        console.log(
            "GM Rules geweigerd: niet ingelogd"
        );

        return toonPagina(
            req,
            res,
            '/src/pages/access/gm-login.html'
        );
    }


    // ----------------------------------------------
    // TOEGANGSCONTROLE
    // ----------------------------------------------
    const allowed =
        gmRulesPublic ||
        req.session.access?.gmRules2014 === true;

    console.log(
        "Toegang 2014 GM Rules:",
        allowed
    );

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

    console.log(
        "GM Rules toegestaan"
    );

    return toonPagina(
        req,
        res,
        '/src/pages/2014/gm-rules.html'
    );


    // ----------------------------------------------
    // Toegang toegestaan
    // ----------------------------------------------

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

app.get(
    '/2024/player-rules',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );

        console.log(
            "2024 player rules bezocht"
        );

        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const pageEnabled =
            settings.pages.dnd2024.playerRules === true;

        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2024 Player Rules is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }

        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2024/player-rules.html'
        );

    }
);

// ----------------------------------------------
// 2024 CHARACTER CREATION
// ----------------------------------------------

app.get(
    '/2024/character-creation',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );

        console.log(
            "2024 character creation bezocht"
        );

        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const pageEnabled =
            settings.pages.dnd2024.characterCreation === true;

        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2024 Character Creation is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }

        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2024/character-creation.html'
        );

    }
);

// ----------------------------------------------
// 2024 PROGRESSION
// ----------------------------------------------

app.get(
    '/2024/progression',
    async (req, res) => {

        res.set(
            'Cache-Control',
            'no-store'
        );

        console.log(
            "2024 progression bezocht"
        );

        // ----------------------------------------------
        // Effectieve pagina-instelling ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        const pageEnabled =
            settings.pages.dnd2024.progression === true;

        // ----------------------------------------------
        // Pagina uitgeschakeld
        // ----------------------------------------------

        if (!pageEnabled) {

            console.log(
                "2024 Progression is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );

        }

        // ----------------------------------------------
        // Pagina beschikbaar
        // ----------------------------------------------

        return toonPagina(
            req,
            res,
            '/src/pages/2024/progression.html'
        );

    }
);

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

        // ----------------------------------------------
        // Effectieve instellingen ophalen
        // ----------------------------------------------

        const settings =
            await getWebsiteSettings();

        // ----------------------------------------------
        // Pagina beschikbaar?
        // ----------------------------------------------

        const pageEnabled =
            settings.pages.dnd2024.gmRules === true;

        if (!pageEnabled) {

            console.log(
                "2024 GM Rules is uitgeschakeld"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/unavailable.html'
            );
        }

        // ----------------------------------------------
        // Publieke toegang?
        // ----------------------------------------------

        const gmRulesPublic =
            settings.access?.gmRulesPublic === true;

        // ----------------------------------------------
        // Niet ingelogd
        // ----------------------------------------------

        if (!gmRulesPublic && !req.session.user) {

            console.log(
                "GM Rules 2024 geweigerd: niet ingelogd"
            );

            return toonPagina(
                req,
                res,
                '/src/pages/access/gm-login.html'
            );
        }

        // ----------------------------------------------
        // GM-toegangscontrole
        // ----------------------------------------------

        const allowed =
            gmRulesPublic ||
            req.session.access?.gmRules2024 === true;

        console.log(
            "Toegang 2024 GM Rules:",
            allowed
        );

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

        // ----------------------------------------------
        // Toegang toegestaan
        // ----------------------------------------------

        console.log(
            "GM Rules 2024 toegestaan"
        );

        return toonPagina(
            req,
            res,
            '/src/pages/2024/gm-rules.html'
        );

    }
);

// ==================================================
// DISCORD LOGIN START
// ==================================================
//
// Deze route start de Discord OAuth2-login.
// De daadwerkelijke verwerking gebeurt daarna
// in /auth/discord/callback.
//

app.get('/auth/discord', (req, res) => {

// ----------------------------------------------
// Onthouden vanaf welke pagina de login
// gestart werd
// ----------------------------------------------

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


    // ----------------------------------------------
    // Geen OAuth code
    // ----------------------------------------------

    if (!code) {

        return res
            .status(400)
            .send(
                'Geen code ontvangen.'
            );

    }


    try {

        // ------------------------------------------
        // OAuth2 token ophalen
        // ------------------------------------------

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


        // ------------------------------------------
        // Discord gebruiker ophalen
        // ------------------------------------------

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


        // ------------------------------------------
        // Toegangsrechten bepalen
        // ------------------------------------------

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


        // ------------------------------------------
        // Gebruiker in sessie opslaan
        // ------------------------------------------

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


        // ------------------------------------------
        // Terug naar pagina waar login gestart werd
        // ------------------------------------------

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
            'Actieve verbindingen voor deze gebruiker:',
            onlineUsers
                .get(user.id)
                .sockets
                .length
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