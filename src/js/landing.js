// ==================================================
// DUNGEONS & GAMES - LANDING PAGE
// ==================================================


// ==================================================
// VERSIES TONEN / VERBERGEN
// ==================================================

const version2014 = document.getElementById("version-2014");
const version2024 = document.getElementById("version-2024");


if (version2014) {

    version2014.style.display =
        SITE_CONFIG.versions.dnd2014 ? "" : "none";

}


if (version2024) {

    version2024.style.display =
        SITE_CONFIG.versions.dnd2024 ? "" : "none";

}


// ==================================================
// PAGINA'S PER VERSIE
// ==================================================

function configureVersionPages(versionId, versionConfig) {

    const versionCard =
        document.getElementById(versionId);


    if (!versionCard) {
        return;
    }


    const playerRules =
        versionCard.querySelector(".page-player-rules");

    const progression =
        versionCard.querySelector(".page-progression");

    const gmRules =
        versionCard.querySelector(".page-gm-rules");


    // ------------------------------
    // Player Rules
    // ------------------------------

    if (playerRules) {

        playerRules.style.display =
            versionConfig.playerRules ? "" : "none";

    }


    // ------------------------------
    // Progression
    // ------------------------------

    if (progression) {

        progression.style.display =
            versionConfig.progression ? "" : "none";

    }


    // ------------------------------
    // GM Rules
    // ------------------------------

    if (gmRules) {

        gmRules.style.display =
            versionConfig.gmRules ? "" : "none";

    }

}


// ==================================================
// CONFIGURATIE TOEPASSEN
// ==================================================

configureVersionPages(
    "version-2014",
    SITE_CONFIG.pages.dnd2014
);


configureVersionPages(
    "version-2024",
    SITE_CONFIG.pages.dnd2024
);