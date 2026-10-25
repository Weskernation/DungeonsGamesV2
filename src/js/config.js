// ==================================================
// DUNGEONS & GAMES - WEBSITE CONFIGURATIE
// ==================================================

const ENABLE_ONLINE_COUNTER = false;


const SITE_CONFIG = {

    // ==================================================
    // ONLINE TELLER
    // ==================================================

    onlineCounter: false,


    // ==================================================
    // D&D VERSIES
    // ==================================================

    versions: {

        dnd2014: true,
        dnd2024: true,
        dnd2034: false

    },


    // ==================================================
    // GM-RULES PUBLIC
    // ==================================================    

    gmRulesPublic: false,

    // ==================================================
    // PAGINA'S PER VERSIE
    // ==================================================

    pages: {

        dnd2014: {

            playerRules: true,
            characterCreation: false,
            progression: true,
            gmRules: false

        },


        dnd2024: {

            playerRules: false,
            characterCreation: false,
            progression: true,
            gmRules: false

        }

    },


    // ==================================================
    // TOOLTIPS
    // ==================================================

    tooltips: {

        enabled: true,
        guestAllowed: false,
        parchment: false,
        dnd2014: true,
        dnd2024: false,
        dnd2034: false

    }

};