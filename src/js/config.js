// ==================================================
// DUNGEONS & GAMES - WEBSITE CONFIGURATIE
// ==================================================


// ==================================================
// D&D VERSIES
// ==================================================

const SITE_CONFIG = {

    versions: {

        dnd2014: true,

        dnd2024: true

    },


    // ==================================================
    // PAGINA'S PER VERSIE
    // ==================================================

    pages: {

        dnd2014: {

            playerRules: false,

            progression: true,

            gmRules: true

        },


        dnd2024: {

            playerRules: true,

            progression: false,

            gmRules: true

        }

    },


    // ==================================================
    // TOOLTIPS
    // ==================================================

    tooltips: {

        enabled: true,

        guestAllowed: false,

        parchment: false

    }

};