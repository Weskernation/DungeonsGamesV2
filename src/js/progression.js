document.addEventListener("DOMContentLoaded", () => {

    // ==================================================
    // PROGRESSION BASIS
    // ==================================================

    const progression =
        document.getElementById("progression-title");

    if (!progression) {
        return;
    }


    // ==================================================
    // ALLE TIERS
    // ==================================================

    const tiers =
        Array.from(
            progression.querySelectorAll(".tier")
        );


    // ==================================================
    // DOORLOPENDE PROGRESSION
    // ==================================================

    let progressionOffset = 0;
    let currentLevel = 1;

    function getStampProgression(stampCell) {

        // Als data-progression-stamp aanwezig is,
        // gebruiken we die.
        if (stampCell.dataset.progressionStamp !== undefined) {

            const progression =
                Number(stampCell.dataset.progressionStamp);

            if (Number.isInteger(progression)) {
                return progression;
            }
        }


        // Anders gebruiken we de zichtbare tekst.
        const text =
            stampCell.textContent.trim();


        // Werkt ook voor milestones zoals "76+"
        const progression =
            parseInt(text, 10);


        if (Number.isInteger(progression)) {
            return progression;
        }


        return null;
    }


    tiers.forEach(tier => {

        const grid =
            tier.querySelector(".progression-grid");

        if (!grid) {
            return;
        }


        // ==================================================
        // ELEMENTEN
        // ==================================================

        const stampCells =
            Array.from(
                grid.querySelectorAll(".stamp")
            );

        const unlockCells =
            Array.from(
                grid.querySelectorAll(".unlock")
            );

        const levelCells =
            Array.from(
                grid.querySelectorAll(".level")
            );


        // ==================================================
        // TIER PROGRESSION
        // ==================================================

        const tierStart =
            progressionOffset;


        // De totale progressionlengte wordt bepaald
        // door de levels, NIET door het aantal zichtbare stamps.

        const tierStampCount =
            levelCells.reduce((total, levelCell) => {

                const stamps =
                    Number(
                        levelCell.dataset.progressionStamps
                    );


                if (
                    !Number.isInteger(stamps) ||
                    stamps < 1
                ) {

                    console.error(
                        "Ongeldige data-progression-stamps op level:",
                        levelCell
                    );

                    return total;
                }


                return total + stamps;

            }, 0);


        const tierEnd =
            tierStart + tierStampCount - 1;


        tier.dataset.progressionStart =
            tierStart;

        tier.dataset.progressionStampCount =
            tierStampCount;

        tier.dataset.progressionEnd =
            tierEnd;


        // ==================================================
        // LEVELS
        // ==================================================

        let currentProgressionStamp = tierStart;


        levelCells.forEach(levelCell => {

            const progressionStamps =
                Number(
                    levelCell.dataset.progressionStamps
                );


            if (
                !Number.isInteger(progressionStamps) ||
                progressionStamps < 1
            ) {

                console.error(
                    "Ongeldige data-progression-stamps op level:",
                    levelCell
                );

                return;
            }


            // ----------------------------------------------
            // INTERNE PROGRESSION
            // ----------------------------------------------

            const levelStart =
                currentProgressionStamp;


            const levelEnd =
                levelStart +
                progressionStamps -
                1;


            // ----------------------------------------------
            // ZICHTBARE STAMPS DIE BIJ DIT LEVEL HOREN
            // ----------------------------------------------

            const visibleStamps =
                stampCells.filter(stampCell => {

                    const progression =
                        getStampProgression(stampCell);


                    if (progression === null) {
                        return false;
                    }


                    return (
                        progression >= levelStart &&
                        progression <= levelEnd
                    );

                });


            // ----------------------------------------------
            // LEVEL POSITIONEREN
            // ----------------------------------------------

            if (visibleStamps.length > 0) {

                const firstStamp =
                    stampCells.indexOf(
                        visibleStamps[0]
                    );


                const lastStamp =
                    stampCells.indexOf(
                        visibleStamps[
                            visibleStamps.length - 1
                        ]
                    );


                const startRow =
                    firstStamp + 2;


                const rowSpan =
                    lastStamp -
                    firstStamp +
                    1;


                levelCell.textContent =
                    currentLevel;


                levelCell.style.gridColumn =
                    "2";


                levelCell.style.gridRow =
                    `${startRow} / span ${rowSpan}`;

            }


            // Volgende level begint na deze progression-range
            currentProgressionStamp =
                levelEnd + 1;


            currentLevel++;

        });


        // ==================================================
        // ZICHTBARE STAMPS
        // ==================================================

        stampCells.forEach((stampCell, index) => {

            const row =
                index + 2;


            stampCell.style.gridColumn =
                "1";


            stampCell.style.gridRow =
                row;

        });


        // ==================================================
        // ZICHTBARE UNLOCKS
        // ==================================================

        unlockCells.forEach((unlockCell, index) => {

            const row =
                index + 2;


            unlockCell.style.gridColumn =
                "7";


            unlockCell.style.gridRow =
                row;

        });


        // ==================================================
        // GRID HOOGTE
        // ==================================================

        grid.style.gridTemplateRows =
            `auto repeat(${stampCells.length}, minmax(40px, auto))`;


        // ==================================================
        // VOLGENDE TIER
        // ==================================================

        progressionOffset +=
            tierStampCount;

    });


        // ==================================================
        // PROGRESSION RANGES
        // ==================================================

        tiers.forEach(tier => {

            const grid =
                tier.querySelector(".progression-grid");

            if (!grid) {
                return;
            }


            const tierStart =
                Number(tier.dataset.progressionStart);


            grid.querySelectorAll(
                "[data-progression-from-stamp]"
            ).forEach(element => {

                // ----------------------------------------------
                // BEGINSTEMPEL
                // ----------------------------------------------

                const fromStamp =
                    Number(
                        element.dataset.progressionFromStamp
                    );


                // ----------------------------------------------
                // EINDSTEMPEL
                // ----------------------------------------------

                let toStamp;


                // Als er geen eindstempel is opgegeven,
                // loopt dit blok door tot het einde van de tier.

                if (
                    element.dataset.progressionToStamp === undefined
                ) {

                    toStamp =
                        Number(
                            tier.dataset.progressionEnd
                        );

                } else {

                    toStamp =
                        Number(
                            element.dataset.progressionToStamp
                        );

                }


                // ----------------------------------------------
                // CONTROLEREN
                // ----------------------------------------------

                if (
                    !Number.isInteger(fromStamp) ||
                    !Number.isInteger(toStamp) ||
                    toStamp < fromStamp
                ) {

                    console.error(
                        "Ongeldig progression-stampbereik:",
                        element
                    );

                    return;
                }


                // ----------------------------------------------
                // GLOBALE STAMP → LOKALE GRID-RIJ
                // ----------------------------------------------

                const startRow =
                    fromStamp -
                    tierStart +
                    2;


                const endRow =
                    toStamp -
                    tierStart +
                    2;


                const rowSpan =
                    endRow -
                    startRow +
                    1;


                // ----------------------------------------------
                // POSITIONEREN
                // ----------------------------------------------

                element.style.gridRow =
                    `${startRow} / span ${rowSpan}`;

            });

        });


    // ==================================================
    // ALGEMENE KOLOMMEN
    // ==================================================

    tiers.forEach(tier => {

        const grid =
            tier.querySelector(".progression-grid");

        if (!grid) {
            return;
        }


        grid.querySelectorAll(".healing")
            .forEach(element => {

                element.style.gridColumn =
                    "3";

            });


        grid.querySelectorAll(".armor")
            .forEach(element => {

                element.style.gridColumn =
                    "4";

            });


        grid.querySelectorAll(".mount")
            .forEach(element => {

                element.style.gridColumn =
                    "5";

            });


        grid.querySelectorAll(".weave")
            .forEach(element => {

                element.style.gridColumn =
                    "6";

            });

    });


});