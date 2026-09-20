// ==================================================
// DUNGEONS & GAMES - SETTINGS
// ==================================================

document.addEventListener("DOMContentLoaded", async () => {

    // ==================================================
    // ELEMENTEN
    // ==================================================

    const onlineCounterToggle =
        document.getElementById(
            "online-counter-toggle"
        );


    const onlineCounterStatus =
        document.getElementById(
            "online-counter-status"
        );


    // ==================================================
    // SETTINGS OPHALEN
    // ==================================================

    let settings;

    try {

        const response =
            await fetch("/api/settings");


        if (!response.ok) {

            throw new Error(
                "Settings konden niet worden opgehaald."
            );

        }


        settings =
            await response.json();

    } catch (error) {

        console.error(
            "Settings laden mislukt:",
            error
        );

        return;

    }


        // ==================================================
        // GM RULES PUBLIC
        // ==================================================

        const gmRulesPublicToggle =
            document.getElementById(
                "access-gm-rules-public"
            );


        if (gmRulesPublicToggle) {

            gmRulesPublicToggle.checked =
                settings.access?.gmRulesPublic === true;


            gmRulesPublicToggle.addEventListener(
                "change",
                async () => {

                    const newValue =
                        gmRulesPublicToggle.checked;


                    try {

                        const response =
                            await fetch(
                                "/api/settings",
                                {

                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            category:
                                                "access",

                                            setting:
                                                "gmRulesPublic",

                                            value:
                                                newValue

                                        })

                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                "Instelling kon niet worden opgeslagen."
                            );

                        }


                        const result =
                            await response.json();


                        gmRulesPublicToggle.checked =
                            result.settings
                                ?.access
                                ?.gmRulesPublic === true;

                    } catch (error) {

                        console.error(
                            "GM Rules toegang wijzigen mislukt:",
                            error
                        );


                        // Switch terugzetten
                        gmRulesPublicToggle.checked =
                            !newValue;

                    }

                }
            );

        }


    // ==================================================
    // ONLINE COUNTER
    // ==================================================

    if (
        onlineCounterToggle &&
        onlineCounterStatus
    ) {

        onlineCounterToggle.checked =
            settings.onlineCounter === true;


        onlineCounterStatus.textContent =
            onlineCounterToggle.checked
                ? "Online teller staat AAN."
                : "Online teller staat UIT.";


        onlineCounterToggle.addEventListener(
            "change",
            async () => {

                const enabled =
                    onlineCounterToggle.checked;


                try {

                    const response =
                        await fetch(
                            "/api/settings/online-counter",
                            {

                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        enabled:
                                            enabled
                                    })

                            }
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Instelling kon niet worden opgeslagen."
                        );

                    }


                    const result =
                        await response.json();


                    onlineCounterToggle.checked =
                        result.onlineCounter === true;


                    onlineCounterStatus.textContent =
                        onlineCounterToggle.checked
                            ? "Online teller staat AAN."
                            : "Online teller staat UIT.";

                } catch (error) {

                    console.error(
                        "Online counter wijzigen mislukt:",
                        error
                    );


                    // Switch terugzetten
                    onlineCounterToggle.checked =
                        !enabled;


                    onlineCounterStatus.textContent =
                        "Instelling kon niet worden opgeslagen.";

                }

            }
        );

    }


    // ==================================================
    // D&D VERSIES
    // ==================================================

    const versionSettings = {

        "version-dnd2014":
            settings.versions?.dnd2014,

        "version-dnd2024":
            settings.versions?.dnd2024,

        "version-dnd2034":
            settings.versions?.dnd2034

    };


    Object.entries(versionSettings)
        .forEach(([id, enabled]) => {

            const toggle =
                document.getElementById(id);


            if (!toggle) {
                return;
            }


            toggle.checked =
                enabled === true;


            toggle.addEventListener(
                "change",
                async () => {

                    const newValue =
                        toggle.checked;


                    try {

                        const response =
                            await fetch(
                                "/api/settings/version",
                                {

                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            version:
                                                id.replace(
                                                    "version-",
                                                    ""
                                                ),

                                            enabled:
                                                newValue

                                        })

                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                "Instelling kon niet worden opgeslagen."
                            );

                        }


                        const result =
                            await response.json();


                        toggle.checked =
                            result.enabled === true;

                    } catch (error) {

                        console.error(
                            "D&D versie wijzigen mislukt:",
                            error
                        );


                        // Switch terugzetten
                        toggle.checked =
                            !newValue;

                    }

                }
            );

        });


    // ==================================================
    // D&D 2014 PAGINA'S
    // ==================================================

    const pageSettings2014 = {

        "page-dnd2014-player-rules":
            ["dnd2014", "playerRules"],

        "page-dnd2014-character-creation":
            ["dnd2014", "characterCreation"],

        "page-dnd2014-progression":
            ["dnd2014", "progression"],

        "page-dnd2014-gm-rules":
            ["dnd2014", "gmRules"]

    };


    // ==================================================
    // D&D 2024 PAGINA'S
    // ==================================================

    const pageSettings2024 = {

        "page-dnd2024-player-rules":
            ["dnd2024", "playerRules"],

        "page-dnd2024-character-creation":
            ["dnd2024", "characterCreation"],

        "page-dnd2024-progression":
            ["dnd2024", "progression"],

        "page-dnd2024-gm-rules":
            ["dnd2024", "gmRules"]

    };


    const pageSettings = {

        ...pageSettings2014,
        ...pageSettings2024

    };


    Object.entries(pageSettings)
        .forEach(([id, setting]) => {

            const toggle =
                document.getElementById(id);


            if (!toggle) {
                return;
            }


            const [
                version,
                page
            ] = setting;


            toggle.checked =
                settings.pages?.[version]?.[page] === true;


            toggle.addEventListener(
                "change",
                async () => {

                    const newValue =
                        toggle.checked;


                    try {

                        const response =
                            await fetch(
                                "/api/settings",
                                {

                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            category:
                                                "pages",

                                            setting: {

                                                version:
                                                    version,

                                                name:
                                                    page

                                            },

                                            value:
                                                newValue

                                        })

                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                "Instelling kon niet worden opgeslagen."
                            );

                        }


                        const result =
                            await response.json();


                        toggle.checked =
                            result.settings
                                ?.pages
                                ?.[version]
                                ?.[page] === true;

                    } catch (error) {

                        console.error(
                            "Pagina-instelling wijzigen mislukt:",
                            error
                        );


                        // Switch terugzetten
                        toggle.checked =
                            !newValue;

                    }

                }
            );

        });


    // ==================================================
    // TOOLTIPS
    // ==================================================

    const tooltipSettings = {

        "tooltip-enabled":
            ["tooltips", "enabled"],

        "tooltip-guest-allowed":
            ["tooltips", "guestAllowed"],

        "tooltip-parchment":
            ["tooltips", "parchment"],

        "tooltip-dnd2014":
            ["tooltips", "dnd2014"],

        "tooltip-dnd2024":
            ["tooltips", "dnd2024"],

        "tooltip-dnd2034":
            ["tooltips", "dnd2034"]

    };


    Object.entries(tooltipSettings)
        .forEach(([id, setting]) => {

            const toggle =
                document.getElementById(id);


            if (!toggle) {
                return;
            }


            const [
                category,
                name
            ] = setting;


            toggle.checked =
                settings[category]?.[name] === true;


            toggle.addEventListener(
                "change",
                async () => {

                    const newValue =
                        toggle.checked;


                    try {

                        const response =
                            await fetch(
                                "/api/settings",
                                {

                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            category:
                                                category,

                                            setting:
                                                name,

                                            value:
                                                newValue

                                        })

                                }
                            );


                        if (!response.ok) {

                            throw new Error(
                                "Instelling kon niet worden opgeslagen."
                            );

                        }


                        const result =
                            await response.json();


                        toggle.checked =
                            result.settings
                                ?.[category]
                                ?.[name] === true;

                    } catch (error) {

                        console.error(
                            "Tooltip-instelling wijzigen mislukt:",
                            error
                        );


                        // Switch terugzetten
                        toggle.checked =
                            !newValue;

                    }

                }
            );

        });

    // ==================================================
    // SETTINGS RESET
    // ==================================================

    const settingsResetButton =
        document.getElementById(
            "settings-reset-button"
        );


    const settingsResetStatus =
        document.getElementById(
            "settings-reset-status"
        );


    if (
        settingsResetButton &&
        settingsResetStatus
    ) {

        settingsResetButton.addEventListener(
            "click",
            async () => {

                // ------------------------------------------
                // Bevestiging
                // ------------------------------------------

                const confirmed =
                    confirm(
                        "Weet je zeker dat je alle tijdelijke instellingen wilt verwijderen en de waarden uit config.js wilt herstellen?"
                    );


                if (!confirmed) {

                    return;

                }


                // ------------------------------------------
                // Reset uitvoeren
                // ------------------------------------------

                try {

                    settingsResetButton.disabled =
                        true;


                    settingsResetStatus.textContent =
                        "Instellingen worden gereset...";


                    const response =
                        await fetch(
                            "/api/settings/reset",
                            {
                                method: "POST"
                            }
                        );


                    if (!response.ok) {

                        throw new Error(
                            "Instellingen konden niet worden gereset."
                        );

                    }


                    // --------------------------------------
                    // Instellingen opnieuw ophalen
                    // --------------------------------------

                    const settingsResponse =
                        await fetch(
                            "/api/settings"
                        );


                    if (!settingsResponse.ok) {

                        throw new Error(
                            "Instellingen konden na de reset niet worden opgehaald."
                        );

                    }


                    settings =
                        await settingsResponse.json();


                    // --------------------------------------
                    // Switches opnieuw instellen
                    // --------------------------------------

                    if (onlineCounterToggle) {

                        onlineCounterToggle.checked =
                            settings.onlineCounter === true;

                    }


                    Object.entries(versionSettings)
                        .forEach(([id]) => {

                            const toggle =
                                document.getElementById(id);


                            if (!toggle) {
                                return;
                            }


                            const version =
                                id.replace(
                                    "version-",
                                    ""
                                );


                            toggle.checked =
                                settings.versions?.[version] === true;

                        });


                    Object.entries(pageSettings)
                        .forEach(([id, setting]) => {

                            const toggle =
                                document.getElementById(id);


                            if (!toggle) {
                                return;
                            }


                            const [
                                version,
                                page
                            ] = setting;


                            toggle.checked =
                                settings.pages?.[version]?.[page] === true;

                        });


                    Object.entries(tooltipSettings)
                        .forEach(([id, setting]) => {

                            const toggle =
                                document.getElementById(id);


                            if (!toggle) {
                                return;
                            }


                            const [
                                category,
                                name
                            ] = setting;


                            toggle.checked =
                                settings[category]?.[name] === true;

                        });


                    // --------------------------------------
                    // Status
                    // --------------------------------------

                    if (onlineCounterStatus) {

                        onlineCounterStatus.textContent =
                            onlineCounterToggle.checked
                                ? "Online teller staat AAN."
                                : "Online teller staat UIT.";

                    }


                    settingsResetStatus.textContent =
                        "Instellingen zijn teruggezet naar config.js.";

                } catch (error) {

                    console.error(
                        "Settings resetten mislukt:",
                        error
                    );


                    settingsResetStatus.textContent =
                        "Instellingen konden niet worden gereset.";

                } finally {

                    settingsResetButton.disabled =
                        false;

                }

            }
        );

    }        

});