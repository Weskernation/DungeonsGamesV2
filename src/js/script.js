// ==================================================
// EFFECTIEVE WEBSITE-INSTELLINGEN
// ==================================================

const siteSettings =
    document.body.dataset.siteSettings
        ? JSON.parse(
            document.body.dataset.siteSettings
        )
        : null;


// ==================================================
// LOOT TABLE LADEN
// ==================================================

async function loadLootTable() {

    const container =
        document.getElementById("loot-table-container");

    if (!container) {
        return;
    }


    // ----------------------------------------------
    // JUISTE LOOT TABLE BEPALEN
    // ----------------------------------------------

    let lootTablePath = null;
    let lootTableCssPath = null;


    if (
        window.location.pathname.startsWith(
            "/2014/"
        )
    ) {

        lootTablePath =
            "/pages/2014/loot-table.html";

        lootTableCssPath =
            "/css/loot-table.css";

    }


    else if (
        window.location.pathname.startsWith(
            "/2024/"
        )
    ) {

        lootTablePath =
            "/pages/2024/loot-table.html";

        lootTableCssPath =
            "/css/loot-table.css";

    }


    if (!lootTablePath) {

        console.error(
            "Geen loot table gevonden voor deze pagina."
        );

        return;

    }


    // ----------------------------------------------
    // LOOT TABLE CSS LADEN
    // ----------------------------------------------

    if (
        lootTableCssPath &&
        !document.querySelector(
            `link[href="${lootTableCssPath}"]`
        )
    ) {

        const stylesheet =
            document.createElement("link");

        stylesheet.rel =
            "stylesheet";

        stylesheet.href =
            lootTableCssPath;

        document.head.appendChild(
            stylesheet
        );

    }


    // ----------------------------------------------
    // LOOT TABLE HTML LADEN
    // ----------------------------------------------

    try {

        const response =
            await fetch(lootTablePath);


        if (!response.ok) {

            console.error(
                "Loot table kon niet worden geladen:",
                lootTablePath,
                response.status
            );

            return;

        }


        const html =
            await response.text();


        container.innerHTML =
            html;


        console.log(
            "Loot table geladen:",
            lootTablePath
        );


    } catch (error) {

        console.error(
            "Fout bij laden van loot table:",
            error
        );

    }

}


document.addEventListener("DOMContentLoaded", async () => {


    // ==================================================
    // NAVIGATIE
    // ==================================================

    const navigation = document.getElementById("main-navigation");

    if (navigation) {

        let navigationHTML = `
            <div class="navigation-inner">

                <a class="navigation-logo" href="/">
                    Dungeons & Games
                </a>

                <div class="navigation-links">
        `;


        // ----------------------------------------------
        // 2014
        // ----------------------------------------------

        if (siteSettings.versions.dnd2014) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        5e (2014)
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (siteSettings.pages.dnd2014.playerRules) {

                navigationHTML += `
                    <a href="/2014/player-rules">
                        Player Rules 5e (2014)
                    </a>
                `;

            }


            if (siteSettings.pages.dnd2014.characterCreation) {

                navigationHTML += `
                    <a href="/2014/character-creation">
                        Character Creation 5e (2014)
                    </a>
                `;

            }


            if (siteSettings.pages.dnd2014.progression) {

                navigationHTML += `
                    <a href="/2014/progression">
                        Progression & Stempelkaart 5e (2014)
                    </a>
                `;

            }


            navigationHTML += `

                    </div>

                </div>

            `;

        }


        // ----------------------------------------------
        // 2024
        // ----------------------------------------------

        if (siteSettings.versions.dnd2024) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        5.5e (2024)
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (siteSettings.pages.dnd2024.playerRules) {

                navigationHTML += `
                    <a href="/2024/player-rules">
                        Player Rules 5.5e (2024)
                    </a>
                `;

            }


            if (siteSettings.pages.dnd2024.characterCreation) {

                navigationHTML += `
                    <a href="/2024/character-creation">
                        Character Creation 5.5e (2024)
                    </a>
                `;

            }


            if (siteSettings.pages.dnd2024.progression) {

                navigationHTML += `
                    <a href="/2024/progression">
                        Progression & Stempelkaart 5.5e (2024)
                    </a>
                `;

            }


            navigationHTML += `

                    </div>

                </div>

            `;

        }


        // ----------------------------------------------
        // GAME MASTER
        // ----------------------------------------------

        if (
            siteSettings.pages.dnd2014.gmRules ||
            siteSettings.pages.dnd2024.gmRules
        ) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        Game Master
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (siteSettings.pages.dnd2014.gmRules) {

                navigationHTML += `
                    <a href="/2014/gm-rules">
                        GM Rules 5e (2014)
                    </a>
                `;

            }


            if (siteSettings.pages.dnd2024.gmRules) {

                navigationHTML += `
                    <a href="/2024/gm-rules">
                        GM Rules 5.5e (2024)
                    </a>
                `;

            }


            navigationHTML += `

                    </div>

                </div>

            `;

        }


        navigationHTML += `

                </div>

            </div>
        `;


        navigation.innerHTML = navigationHTML;


        // ==================================================
        // SETTINGS
        // ==================================================
        //
        // Alleen zichtbaar voor Settings-admins.
        // De server bepaalt of de gebruiker toegang heeft.
        // ==================================================

        fetch('/api/settings')
            .then(response => {

                if (!response.ok) {
                    return null;
                }

                return response.json();

            })
            .then(settings => {

                if (!settings) {
                    return;
                }


                const navigationLinks =
                    navigation.querySelector(
                        '.navigation-links'
                    );


                if (!navigationLinks) {
                    return;
                }


                const settingsLink =
                    document.createElement('a');

                settingsLink.href =
                    '/settings';

                settingsLink.textContent =
                    '⚙ Settings';

                settingsLink.className =
                    'navigation-settings';


                navigationLinks.appendChild(
                    settingsLink
                );

            })
            .catch(() => {

                // Geen toegang of serverfout:
                // Settings blijft gewoon verborgen.

            });


        // ==================================================
        // NAVIGATIE DROPDOWNS
        // ==================================================

        const dropdowns =
            navigation.querySelectorAll(
                ".navigation-dropdown"
            );


        function closeAllDropdowns(except = null) {

            dropdowns.forEach(dropdown => {

                if (dropdown !== except) {

                    dropdown.classList.remove(
                        "open"
                    );

                }

            });

        }


        dropdowns.forEach(dropdown => {

            const button =
                dropdown.querySelector(
                    ".navigation-dropdown-button"
                );


            if (!button) {
                return;
            }


            // ----------------------------------------------
            // KLIK / TAP
            // ----------------------------------------------

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const wasOpen =
                        dropdown.classList.contains(
                            "open"
                        );


                    // Eerst alle andere dropdowns sluiten
                    closeAllDropdowns();


                    // Huidige alleen openen als deze nog dicht was
                    if (!wasOpen) {

                        dropdown.classList.add(
                            "open"
                        );

                    }

                }
            );


            // ----------------------------------------------
            // DESKTOP HOVER
            // ----------------------------------------------

            dropdown.addEventListener(
                "mouseenter",
                () => {

                    if (
                        window.matchMedia(
                            "(hover: hover) and (pointer: fine)"
                        ).matches
                    ) {

                        closeAllDropdowns(
                            dropdown
                        );

                        dropdown.classList.add(
                            "open"
                        );

                    }

                }
            );


            dropdown.addEventListener(
                "mouseleave",
                () => {

                    if (
                        window.matchMedia(
                            "(hover: hover) and (pointer: fine)"
                        ).matches
                    ) {

                        dropdown.classList.remove(
                            "open"
                        );

                    }

                }
            );

        });


        // ==================================================
        // DROPDOWN SLUITEN BIJ KLIK BUITEN NAVIGATIE
        // ==================================================

        document.addEventListener(
            "click",
            event => {

                if (!navigation.contains(event.target)) {

                    closeAllDropdowns();

                }

            }
        );

    }


    // ==================================================
    // CREDITS
    // ==================================================

    const credits = {

        // ==================================================
        // 2014
        // ==================================================

        "2014-progression": `
            <div class="credits">
                <div>
                    A collaborative creation by David, Johanna, Robin and Wesley.
                </div>
            </div>
        `,

        "2014-player-rules": `
            <div class="credits">
                <div>
                    
                </div>
            </div>
        `,

        "2014-gm-rules": `
            <div class="credits">
                <div>
                    
                </div>
            </div>
        `,


        // ==================================================
        // 2024
        // ==================================================

        "2024-progression": `
            <div class="credits">
                <div>
                    Deze pagina wordt aan gewerkt. En mag tot ander order niet gebruikt worden.
                </div>
            </div>
        `,

        "2024-player-rules": `
            <div class="credits">
                <div>
                    
                </div>
            </div>
        `,

        "2024-gm-rules": `
            <div class="credits">
                <div>
                    
                </div>
            </div>
        `,


        // ==================================================
        // 2034
        // ==================================================

        "2034-progression": `
            ...
        `,

        "2034-player-rules": `
            ...
        `

    };


    document.querySelectorAll(".credits-container")
        .forEach(container => {

            const creditType =
                container.dataset.credits;


            if (!creditType) {
                return;
            }


            const creditContent =
                credits[creditType];


            if (!creditContent) {
                return;
            }


            container.innerHTML =
                creditContent;

        });


    // ==================================================
    // LOOT TABLE
    // ==================================================

    await loadLootTable();

    document.dispatchEvent(
        new Event("lootTableLoaded")
    );


    // ==================================================
    // TOOLTIP INITIALISEREN
    // ==================================================

    initializeLootTable();


    // ==================================================
    // LOOT GRID - AANTAL KOLOMMEN
    // ==================================================

    function updateLootGrid() {

        document.querySelectorAll(".loot-grid")
            .forEach(grid => {

                const firstRoll =
                    grid.querySelector(".loot-roll");


                if (!firstRoll) {
                    return;
                }


                let itemCount = 0;

                let element =
                    firstRoll.nextElementSibling;


                while (
                    element &&
                    !element.classList.contains("loot-roll")
                ) {

                    if (
                        element.classList.contains("loot-item")
                    ) {

                        itemCount++;

                    }


                    element =
                        element.nextElementSibling;

                }


                if (itemCount > 0) {

                    // ------------------------------------------
                    // PORTRAIT
                    // ------------------------------------------

                    if (
                        window.innerWidth <= 768 &&
                        window.innerWidth <= window.innerHeight
                    ) {

                        grid.style.gridTemplateColumns =
                            "repeat(2, minmax(0, 1fr))";

                    }


                    // ------------------------------------------
                    // DESKTOP + LANDSCAPE
                    // ------------------------------------------

                    else {

                        grid.style.gridTemplateColumns =
                            `70px repeat(${itemCount}, minmax(0, 1fr))`;

                    }

                }

            });

    }


    updateLootGrid();

    window.addEventListener(
        "resize",
        updateLootGrid
    );


    // ==================================================
    // FLOATING MENU
    // ==================================================

    document.querySelectorAll(".floating-menu button")
        .forEach(button => {

            const image =
                button.dataset.image;


            if (!image) {
                return;
            }


            const img =
                new Image();


            img.onload = () => {

                button.style.backgroundImage =
                    `url('${image}')`;

                button.classList.add(
                    "has-image"
                );

            };


            img.src =
                image;

        });

});


// ==================================================
// NAAR SECTIE SCROLLEN
// ==================================================

function scrollToSection(id) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    element.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

}