// ==================================================
// DUNGEONS & GAMES - WEBSITE CONFIGURATIE
// ==================================================


// ==================================================
// D&D VERSIES
// ==================================================

const SITE_CONFIG = {

    versions: {

        dnd2014: true,

        dnd2024: true,

        dnd2034: false

    },


    // ==================================================
    // PAGINA'S PER VERSIE
    // ==================================================

    pages: {

        dnd2014: {

            playerRules: false,

            characterCreation: true,

            progression: true,

            gmRules: true

        },


        dnd2024: {

            playerRules: true,

            characterCreation: true,

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

        parchment: false,

        dnd2014: true,

        dnd2024: false,

        dnd2034: false

    }

};