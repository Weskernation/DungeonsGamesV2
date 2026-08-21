document.addEventListener("DOMContentLoaded", () => {


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

        if (SITE_CONFIG.versions.dnd2014) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        5e (2014)
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (SITE_CONFIG.pages.dnd2014.playerRules) {

                navigationHTML += `
                    <a href="/2014/player-rules">
                        Player Rules 5e (2014)
                    </a>
                `;

            }


            if (SITE_CONFIG.pages.dnd2014.progression) {

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

        if (SITE_CONFIG.versions.dnd2024) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        5.5e (2024)
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (SITE_CONFIG.pages.dnd2024.playerRules) {

                navigationHTML += `
                    <a href="/2024/player-rules">
                        Player Rules 5.5e (2024)
                    </a>
                `;

            }


            if (SITE_CONFIG.pages.dnd2024.progression) {

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
            SITE_CONFIG.pages.dnd2014.gmRules ||
            SITE_CONFIG.pages.dnd2024.gmRules
        ) {

            navigationHTML += `

                <div class="navigation-dropdown">

                    <button class="navigation-dropdown-button" type="button">
                        Game Master
                        <span class="navigation-arrow">▼</span>
                    </button>

                    <div class="navigation-dropdown-content">
            `;


            if (SITE_CONFIG.pages.dnd2014.gmRules) {

                navigationHTML += `
                    <a href="/2014/gm-rules">
                        GM Rules 5e (2014)
                    </a>
                `;

            }


            if (SITE_CONFIG.pages.dnd2024.gmRules) {

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
        // NAVIGATIE DROPDOWNS
        // ==================================================

        const dropdowns =
            navigation.querySelectorAll(".navigation-dropdown");


        function closeAllDropdowns(except = null) {

            dropdowns.forEach(dropdown => {

                if (dropdown !== except) {

                    dropdown.classList.remove("open");

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

            button.addEventListener("click", event => {

                event.stopPropagation();


                const wasOpen =
                    dropdown.classList.contains("open");


                // Eerst alle andere dropdowns sluiten
                closeAllDropdowns();


                // Huidige alleen openen als deze nog dicht was
                if (!wasOpen) {

                    dropdown.classList.add("open");

                }

            });


            // ----------------------------------------------
            // DESKTOP HOVER
            // ----------------------------------------------

            dropdown.addEventListener("mouseenter", () => {

                if (
                    window.matchMedia(
                        "(hover: hover) and (pointer: fine)"
                    ).matches
                ) {

                    closeAllDropdowns(dropdown);

                    dropdown.classList.add("open");

                }

            });


            dropdown.addEventListener("mouseleave", () => {

                if (
                    window.matchMedia(
                        "(hover: hover) and (pointer: fine)"
                    ).matches
                ) {

                    dropdown.classList.remove("open");

                }

            });

        });


        // ==================================================
        // DROPDOWN SLUITEN BIJ KLIK BUITEN NAVIGATIE
        // ==================================================

        document.addEventListener("click", event => {

            if (!navigation.contains(event.target)) {

                closeAllDropdowns();

            }

        });

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


        // ==================================================
        // 2024
        // ==================================================

        "2024-progression": `
                <div class="credits">
                    <div>
                        
                    </div>
                </div>
            `,

        "2024-player-rules": `
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

            const creditType = container.dataset.credits;

            if (!creditType) {
                return;
            }

            const creditContent = credits[creditType];

            if (!creditContent) {
                return;
            }

            container.innerHTML = creditContent;

        });


    // ==================================================
    // LOOT TIER INFO
    // ==================================================

    document.querySelectorAll(".loot-tier-info")
        .forEach(panel => {

            if (panel.textContent.trim() === "") {
                panel.style.visibility = "hidden";
            }

        });


    // ==================================================
    // LOOT ITEMS
    // ==================================================

    document.querySelectorAll(".loot-item")
        .forEach(item => {

            if (item.dataset.attunement === "true") {
                item.classList.add("attunement");
            }

            if (item.dataset.excluded === "true") {
                item.classList.add("excluded");
            }

        });


    // ==================================================
    // FLOATING MENU
    // ==================================================

    document.querySelectorAll(".floating-menu button")
        .forEach(button => {

            const image = button.dataset.image;

            if (!image) {
                return;
            }


            const img = new Image();

            img.onload = () => {

                button.style.backgroundImage =
                    `url('${image}')`;

                button.classList.add("has-image");

            };


            img.src = image;

        });

});


// ==================================================
// NAAR SECTIE SCROLLEN
// ==================================================

function scrollToSection(id) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }


    element.scrollIntoView({

        behavior: "smooth",

        block: "start"

    });

}