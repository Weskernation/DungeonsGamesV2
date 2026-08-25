const ENABLE_ITEM_TOOLTIPS =
    SITE_CONFIG.tooltips.enabled;

const GUEST_TOOLTIPS_ALLOWED =
    SITE_CONFIG.tooltips.guestAllowed;

const ENABLE_PARCHMENT_TOOLTIPS =
    SITE_CONFIG.tooltips.parchment;


// ==========================================
// TOOLTIP VERSIE
// ==========================================

const pageVersion =
    document.body.dataset.version;

const VERSION_TOOLTIPS_ALLOWED =
    SITE_CONFIG.tooltips[pageVersion] === true;

const MOBILE_WIDTH = 900;
const MOBILE_LANDSCAPE_HEIGHT = 500;


function isMobileTooltip() {

    const isNarrow =
        window.innerWidth <= MOBILE_WIDTH;

    const isShortLandscape =
        window.innerHeight <= MOBILE_LANDSCAPE_HEIGHT &&
        window.innerWidth > window.innerHeight;

    return isNarrow || isShortLandscape;
}


// ==========================================
// TOEGANG TOT TOOLTIPS
// ==========================================

const isDiscordUser =
    !!document.body.dataset.user;


const TOOLTIP_ACCESS_ALLOWED =
    ENABLE_ITEM_TOOLTIPS &&
    VERSION_TOOLTIPS_ALLOWED &&
    (
        isDiscordUser ||
        GUEST_TOOLTIPS_ALLOWED
    );


// ==========================================
// LOOT TABLE INITIALISEREN
// ==========================================

async function initializeLootTable() {

    if (!TOOLTIP_ACCESS_ALLOWED) {
        return;
    }


    document.body.classList.add(
        "item-tooltips-disabled"
    );


    // ==========================================
    // ITEMS.JSON LADEN
    // ==========================================

    let items;

    try {

        const response =
            await fetch("/data/items.json");


        console.log(
            "JSON response:",
            response
        );


        if (!response.ok) {

            console.error(
                "Items.json kon niet worden geladen."
            );

            return;
        }


        items =
            await response.json();


        console.log(
            "Items loaded:",
            items
        );

    } catch (error) {

        console.error(
            "Fout bij laden van items.json:",
            error
        );

        return;
    }


    // ==========================================
    // ALLE LOOT ITEMS
    // ==========================================

    document
        .querySelectorAll(
            ".loot-item[data-item]"
        )
        .forEach(cell => {

            const itemName =
                cell.dataset.item;


            if (!itemName) {
                return;
            }


            const item =
                items[itemName];


            if (!item) {

                console.warn(
                    "Item niet gevonden in items.json:",
                    itemName
                );

                return;
            }


            if (!item.type && !item.rarity) {
                return;
            }


            // ==========================================
            // VOORKOM DUBBELE TOOLTIPS
            // ==========================================

            if (
                cell.querySelector(
                    ".item-description"
                )
            ) {
                return;
            }


            const tooltip =
                document.createElement("div");


            tooltip.className =
                "item-description";


            tooltip.innerHTML = `

                <div class="item-meta">

                    ${item.type} | ${item.rarity}

                    <br>

                    ${item.attunement?.required
                        ? `<br>Requires Attunement${item.attunement.who ? " " + item.attunement.who : ""}`
                        : ""}

                </div><hr>


                ${item.description?.length ? `

                <div class="item-description-text">

                    ${item.description
                        .map(
                            text =>
                                `<p>${text}</p>`
                        )
                        .join("")}

                </div>

                ` : ""}


                ${item.effects?.length ? `

                <h4>Effects</h4>

                <ul>

                    ${item.effects
                        .map(
                            effect =>
                                `<li>${effect}</li>`
                        )
                        .join("")}

                </ul>

                ` : ""}


                ${item.abilities?.length ? `

                <h4>Abilities</h4>

                ${item.abilities
                    .map(ability => `

                    <div class="ability">

                        <strong>
                            ${ability.name}
                        </strong>

                        <br>

                        ${
                            ability.action
                                ? "<strong>Use:</strong> " +
                                  ability.action +
                                  "<br>"
                                : ""
                        }

                        ${ability.effect}

                        <br>

                        ${
                            ability.recharge
                                ? "<strong>Recharge:</strong> " +
                                  ability.recharge
                                : ""
                        }

                        <br>

                    </div>

                `)
                    .join("<br>")}

                ` : ""}


                ${item.variants?.length ? `

                <h4>Variants</h4>

                <ul>

                    ${item.variants
                        .map(
                            variant =>
                                `<li>${variant}</li>`
                        )
                        .join("")}

                </ul>

                ` : ""}


                ${
                    item.notes !== undefined

                        ? (
                            item.notes.trim() !== ""

                                ? `

                        <div class="item-source-note">

                            ${item.notes}

                        </div>

                        `

                                : ""
                        )

                        : `

                        <div class="item-source-note">

                            Compact summary only.
                            Refer to the official source
                            for the complete item description.

                        </div>

                        `
                }

            `;


            cell.appendChild(
                tooltip
            );


            // ==========================================
            // MOBIEL / TIKKEN
            // ==========================================

            cell.addEventListener(
                "click",
                (event) => {

                    if (
                        !isMobileTooltip()
                    ) {
                        return;
                    }


                    // Respecteer de OFF/ON-knop
                    if (
                        !document.body.classList.contains(
                            "item-tooltips-enabled"
                        )
                    ) {
                        return;
                    }


                    event.stopPropagation();


                    // Sluit eventueel al geopende tooltip
                    document
                        .querySelectorAll(
                            ".item-description.mobile-open"
                        )
                        .forEach(
                            t =>
                                t.classList.remove(
                                    "mobile-open"
                                )
                        );


                    document
                        .querySelectorAll(
                            ".tooltip-overlay"
                        )
                        .forEach(
                            o =>
                                o.remove()
                        );


                    // Achtergrond
                    const overlay =
                        document.createElement(
                            "div"
                        );


                    overlay.className =
                        "tooltip-overlay";


                    overlay.addEventListener(
                        "click",
                        () => {

                            tooltip.classList.remove(
                                "mobile-open"
                            );

                            overlay.remove();

                        }
                    );


                    document.body.appendChild(
                        overlay
                    );


                    tooltip.classList.add(
                        "mobile-open"
                    );

                }
            );


            // ==========================================
            // DESKTOP / HOVER
            // ==========================================

            cell.addEventListener(
                "mouseenter",
                () => {

                    if (
                        isMobileTooltip()
                    ) {
                        return;
                    }


                    // ==========================================
                    // TOOLTIP POSITIONERING RESETTEN
                    // ==========================================

                    tooltip.style.left = "";
                    tooltip.style.right = "";
                    tooltip.style.top = "";
                    tooltip.style.bottom = "";
                    tooltip.style.marginLeft = "";
                    tooltip.style.marginRight = "";
                    tooltip.style.transform = "";


                    tooltip.style.visibility =
                        "hidden";


                    tooltip.style.display =
                        "block";


                    // ==========================================
                    // TOOLTIP METEN
                    // ==========================================

                    const tooltipRect =
                        tooltip.getBoundingClientRect();

                    const cellRect =
                        cell.getBoundingClientRect();


                    const tooltipWidth =
                        tooltipRect.width;

                    const tooltipHeight =
                        tooltipRect.height;


                    const spaceLeft =
                        cellRect.left;

                    const spaceRight =
                        window.innerWidth -
                        cellRect.right;


                    // ==========================================
                    // HORIZONTALE TOOLTIP-POSITIE
                    // ==========================================

                    /*
                     * Eerst bepalen we welke kant de voorkeur heeft.
                     *
                     * Rechts heeft prioriteit wanneer de volledige
                     * tooltip daar past.
                     *
                     * Anders proberen we links.
                     *
                     * Als hij aan geen van beide kanten volledig past,
                     * kiezen we de kant met de meeste beschikbare ruimte.
                     */

                    if (
                        spaceRight >= tooltipWidth + 10
                    ) {

                        tooltip.style.left =
                            "100%";

                        tooltip.style.right =
                            "auto";

                        tooltip.style.marginLeft =
                            "10px";

                        tooltip.style.marginRight =
                            "0";

                    }

                    else if (
                        spaceLeft >= tooltipWidth + 10
                    ) {

                        tooltip.style.left =
                            "auto";

                        tooltip.style.right =
                            "100%";

                        tooltip.style.marginLeft =
                            "0";

                        tooltip.style.marginRight =
                            "10px";

                    }

                    else if (
                        spaceRight >= spaceLeft
                    ) {

                        tooltip.style.left =
                            "100%";

                        tooltip.style.right =
                            "auto";

                        tooltip.style.marginLeft =
                            "10px";

                        tooltip.style.marginRight =
                            "0";

                    }

                    else {

                        tooltip.style.left =
                            "auto";

                        tooltip.style.right =
                            "100%";

                        tooltip.style.marginLeft =
                            "0";

                        tooltip.style.marginRight =
                            "10px";

                    }


                    // ==========================================
                    // TOOLTIP OPNIEUW METEN
                    // ==========================================

                    const positionedTooltipRect =
                        tooltip.getBoundingClientRect();


                    // ==========================================
                    // HORIZONTALE CORRECTIE
                    // ==========================================

                    let correctionX = 0;


                    // Links buiten het scherm
                    if (
                        positionedTooltipRect.left < 10
                    ) {

                        correctionX =
                            10 -
                            positionedTooltipRect.left;

                    }


                    // Rechts buiten het scherm
                    else if (
                        positionedTooltipRect.right >
                        window.innerWidth - 10
                    ) {

                        correctionX =
                            (window.innerWidth - 10) -
                            positionedTooltipRect.right;

                    }


                    // ==========================================
                    // VERTICALE CORRECTIE
                    // ==========================================

                    let correctionY = 0;


                    // Boven het scherm
                    if (
                        positionedTooltipRect.top < 10
                    ) {

                        correctionY =
                            10 -
                            positionedTooltipRect.top;

                    }


                    // Onder het scherm
                    else if (
                        positionedTooltipRect.bottom >
                        window.innerHeight - 10
                    ) {

                        correctionY =
                            (window.innerHeight - 10) -
                            positionedTooltipRect.bottom;

                    }


                    // ==========================================
                    // CORRECTIE TOEPASSEN
                    // ==========================================

                    if (
                        correctionX !== 0 ||
                        correctionY !== 0
                    ) {

                        tooltip.style.transform =
                            `translate(${correctionX}px, ${correctionY}px)`;

                    }


                    // ==========================================
                    // TOOLTIP ZICHTBAAR MAKEN
                    // ==========================================

                    tooltip.style.visibility =
                        "";

                }
            );


            cell.addEventListener(
                "mouseleave",
                () => {

                    if (
                        isMobileTooltip()
                    ) {
                        return;
                    }


                    tooltip.style.left = "";
                    tooltip.style.right = "";
                    tooltip.style.top = "";
                    tooltip.style.bottom = "";
                    tooltip.style.marginLeft = "";
                    tooltip.style.marginRight = "";
                    tooltip.style.transform = "";

                }
            );

        });

}


// ==========================================
// TOOLTIP KNOP
// ==========================================

const tooltipButton =
    document.getElementById(
        "toggle-item-tooltips"
    );


if (
    TOOLTIP_ACCESS_ALLOWED &&
    tooltipButton
) {

    let tooltipMode = 0;


    tooltipButton.addEventListener(
        "click",
        () => {


            // ==========================================
            // MODUS WISSELEN
            // ==========================================

            if (
                ENABLE_PARCHMENT_TOOLTIPS
            ) {

                // 0 = OFF
                // 1 = ON + parchment
                // 2 = ON normaal

                tooltipMode++;


                if (
                    tooltipMode > 2
                ) {

                    tooltipMode = 0;

                }

            } else {

                // 0 = OFF
                // 1 = ON normaal

                tooltipMode++;


                if (
                    tooltipMode > 1
                ) {

                    tooltipMode = 0;

                }

            }


            // ==========================================
            // ALLES EERST RESETTEN
            // ==========================================

            document.body.classList.remove(
                "item-tooltips-enabled",
                "item-tooltips-disabled"
            );


            document
                .querySelectorAll(
                    ".item-description"
                )
                .forEach(
                    tooltip => {

                        tooltip.classList.remove(
                            "parchment"
                        );

                    }
                );


            tooltipButton.classList.remove(
                "parchment-mode",
                "tooltip-on-mode"
            );


            // ==========================================
            // OFF
            // ==========================================

            if (
                tooltipMode === 0
            ) {

                document.body.classList.add(
                    "item-tooltips-disabled"
                );


                tooltipButton.textContent =
                    "Loot Tooltips: OFF";

            }


            // ==========================================
            // ON + PARCHMENT
            // ==========================================

            if (
                tooltipMode === 1 &&
                ENABLE_PARCHMENT_TOOLTIPS
            ) {

                document.body.classList.add(
                    "item-tooltips-enabled"
                );


                document
                    .querySelectorAll(
                        ".item-description"
                    )
                    .forEach(
                        tooltip => {

                            tooltip.classList.add(
                                "parchment"
                            );

                        }
                    );


                tooltipButton.textContent =
                    "Loot Tooltips: ON";


                tooltipButton.classList.add(
                    "parchment-mode"
                );

            }


            // ==========================================
            // ON NORMAAL
            // ==========================================

            if (
                tooltipMode === 1 &&
                !ENABLE_PARCHMENT_TOOLTIPS
            ) {

                document.body.classList.add(
                    "item-tooltips-enabled"
                );


                tooltipButton.textContent =
                    "Loot Tooltips: ON";


                tooltipButton.classList.add(
                    "tooltip-on-mode"
                );

            }


            // ==========================================
            // ON NORMAAL NA PARCHMENT
            // ==========================================

            if (
                tooltipMode === 2 &&
                ENABLE_PARCHMENT_TOOLTIPS
            ) {

                document.body.classList.add(
                    "item-tooltips-enabled"
                );


                tooltipButton.textContent =
                    "Loot Tooltips: ON";


                tooltipButton.classList.add(
                    "tooltip-on-mode"
                );

            }

        }
    );

}


// ==========================================
// TOOLTIP KNOP ZICHTBAARHEID
// ==========================================

if (
    TOOLTIP_ACCESS_ALLOWED &&
    tooltipButton
) {

    let visibleSections =
        new Set();


    const observer =
        new IntersectionObserver(
            (entries) => {

                entries.forEach(
                    entry => {

                        if (
                            entry.isIntersecting
                        ) {

                            visibleSections.add(
                                entry.target
                            );

                        } else {

                            visibleSections.delete(
                                entry.target
                            );

                        }

                    }
                );


                if (
                    visibleSections.size > 0
                ) {

                    tooltipButton
                        .parentElement
                        .classList.add(
                            "visible"
                        );

                } else {

                    tooltipButton
                        .parentElement
                        .classList.remove(
                            "visible"
                        );

                }

            },
            {
                rootMargin:
                    "0px 0px 0px 0px"
            }
        );


    // ==========================================
    // SECTIES OBSERVEREN
    // ==========================================

    function observeTooltipSections() {

        const tooltipSections =
            document.querySelectorAll(
                "#progression-title, #loot-table"
            );

        
        console.log(
            "Tooltip sections gevonden:",
            tooltipSections
        );


        tooltipSections.forEach(
            section => {

                // Voorkom dat dezelfde sectie
                // meerdere keren wordt geobserveerd
                if (
                    !section.dataset.tooltipObserved
                ) {

                    observer.observe(
                        section
                    );


                    section.dataset.tooltipObserved =
                        "true";

                }

            }
        );

    }


    // ==========================================
    // DIRECT AANWEZIGE SECTIES
    // ==========================================

    observeTooltipSections();


    // ==========================================
    // EXTERNE LOOT TABLE
    // ==========================================

    document.addEventListener(
        "lootTableLoaded",
        () => {

            observeTooltipSections();

        }
    );

}


// ==========================================
// TOOLTIP TOEGANG NIET TOEGESTAAN
// ==========================================

if (!TOOLTIP_ACCESS_ALLOWED) {

    if (tooltipButton) {

        tooltipButton.style.display =
            "none";

    }


    document.body.classList.add(
        "item-tooltips-disabled"
    );

}