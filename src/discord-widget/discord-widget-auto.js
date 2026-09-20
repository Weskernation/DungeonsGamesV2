// ==================================================
// ONLINE-WIDGET AUTOMATISCH AANMAKEN
// ==================================================

const onlineCounterEnabled =
    document.body.dataset.onlineCounter === 'true';
    
const onlineWidget = document.createElement('div');

onlineWidget.id = 'online-widget';


if (onlineCounterEnabled) {

    onlineWidget.innerHTML = `
        <div id="online-header">
            🟢 Online: <span id="online-count">0</span>
        </div>

        <div id="online-list"></div>
    `;

}


document.body.appendChild(onlineWidget);


// ==================================================
// SOCKET.IO
// Alleen wanneer de online teller actief is
// ==================================================

let socket = null;


if (onlineCounterEnabled) {

    socket = io({
        transports: ['websocket']
    });


    socket.on('connect', () => {

        console.log(
            'Socket.IO verbonden:',
            socket.id
        );

    });


    socket.on('disconnect', (reason) => {

        console.log(
            'Socket.IO verbinding verbroken:',
            reason
        );

    });


    socket.on('connect_error', (error) => {

        console.error(
            'Socket.IO connect_error:',
            error.message
        );

    });

}


const userData = document.body.dataset.user;


// ==================================================
// DISCORD-GEBRUIKER
// ==================================================

if (userData) {

    const user = JSON.parse(userData);


    // ---------------------------------
    // Uitlogknop
    // Blijft altijd beschikbaar
    // ---------------------------------

    const logoutButton =
        document.createElement('a');

    logoutButton.id =
        'logout-button';

    logoutButton.href =
        '/logout';

    logoutButton.textContent =
        'Uitloggen';

    onlineWidget.appendChild(
        logoutButton
    );


    // ---------------------------------
    // Online teller
    // ---------------------------------

    if (onlineCounterEnabled) {

        socket.on('onlineUsers', (data) => {

            console.log(
                "Ontvangen online data:",
                data
            );


            const count =
                document.getElementById(
                    'online-count'
                );

            const list =
                document.getElementById(
                    'online-list'
                );


            if (!count || !list) {
                return;
            }


            const users =
                data.users || [];

            const guestCount =
                data.guestCount || 0;


            // Totaal aantal online bezoekers
            count.textContent =
                users.length + guestCount;


            list.innerHTML = "";


            // Discord-gebruikers
            users.forEach(user => {

                const item =
                    document.createElement('p');

                item.innerHTML =
                    user.global_name +
                    "<br>" +
                    "<small>@" +
                    user.username +
                    "</small>";

                list.appendChild(item);

            });


            // Anonieme bezoekers
            if (guestCount > 0) {

                const item =
                    document.createElement('p');

                item.textContent =
                    `Anoniem (${guestCount})`;

                list.appendChild(item);

            }

        });


        // ---------------------------------
        // Registreren als Discord-gebruiker
        // ---------------------------------

        socket.emit(
            'registerUser',
            user
        );


        // ---------------------------------
        // Online-widget bediening
        // Alleen wanneer teller actief is
        // ---------------------------------

        const onlineHeader =
            document.getElementById(
                'online-header'
            );


        if (onlineHeader) {

            onlineHeader.addEventListener(
                'click',
                () => {

                    onlineWidget.classList.toggle(
                        'open'
                    );

                }
            );

        }

    }


} else {

    // ==================================================
    // ANONIEME BEZOEKER
    // ==================================================


    // ---------------------------------
    // Inlogknop
    // Blijft altijd beschikbaar
    // ---------------------------------

    const loginButton =
        document.createElement('a');

    loginButton.id =
        'logout-button';

    loginButton.href =
        '/auth/discord';

    loginButton.textContent =
        'Inloggen met Discord';

    onlineWidget.appendChild(
        loginButton
    );


    // ---------------------------------
    // Online aantal
    // ---------------------------------

    if (onlineCounterEnabled) {

        socket.on('onlineUsers', (data) => {

            console.log(
                "Ontvangen online data voor gast:",
                data
            );


            const count =
                document.getElementById(
                    'online-count'
                );

            const list =
                document.getElementById(
                    'online-list'
                );


            if (!count || !list) {
                return;
            }


            const users =
                data.users || [];

            const guestCount =
                data.guestCount || 0;


            // Totaal aantal online bezoekers
            count.textContent =
                users.length + guestCount;


            // ---------------------------------
            // Voor anonieme bezoekers:
            // GEEN namen en GEEN Anoniem (X)
            // ---------------------------------

            list.innerHTML = "";

        });


        // ---------------------------------
        // Registreren als anonieme bezoeker
        // ---------------------------------

        socket.emit(
            'registerGuest'
        );

    }

}